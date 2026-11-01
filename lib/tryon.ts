import sharp from 'sharp';
import { fetchImage, runTask, uploadImage, YouCamError } from './youcam';
import { isMock } from './mock';
import { mergeMasks, segment, type Segment } from './sam';
import type { ImagePayload } from './types';

/**
 * 내 손에 입혀보기 — 사용자 손 사진 + 고른 팁셋 → 손가락마다 정해진 팁이 올라간 내 손 사진.
 *
 * YouCam AI Nail Transfer는 참고 사진의 '분위기'를 다섯 손톱에 나눠 입힐 뿐, 어느 팁이 어느 손가락에
 * 갈지는 보장하지 않는다 (2026-11-01 실측: 순서를 뒤집어도 중지·약지는 어긋남). 그래서:
 *  1. SAM으로 팁셋 윗줄 5개(왼쪽=엄지 … 오른쪽=새끼)를 오리고, 손 사진의 손톱 5개와 엄지 위치를 찾는다
 *  2. 팁 하나만 5번 반복한 참고 사진으로 YouCam을 5번 + 세트 전체로 1번(바탕), 동시에 (회당 6 unit)
 *  3. k번째 결과에서 k번째 손가락 손톱만 SAM으로 떼어 바탕 위에 붙인다 — YouCam은 손톱 밖을 안 바꾼다
 * 손톱 5개·엄지를 못 찾으면 윗줄 5개를 한 장에 담아 YouCam 1회로 대신한다.
 */

export class NoNailsError extends Error {}

type Img = { buf: Buffer; W: number; H: number; payload: ImagePayload };

async function toJpeg(img: ImagePayload): Promise<Img> {
  const buf = await sharp(Buffer.from(img.data, 'base64')).rotate().removeAlpha().jpeg({ quality: 92 }).toBuffer();
  const { width: W, height: H } = (await sharp(buf).metadata()) as { width: number; height: number };
  return { buf, W, H, payload: { data: buf.toString('base64'), mimeType: 'image/jpeg' } };
}

const center = (s: Segment) => ({ x: (s.box.left + s.box.right) / 2, y: (s.box.top + s.box.bottom) / 2 });
const area = (s: Segment) => (s.box.right - s.box.left) * (s.box.bottom - s.box.top);

/** 팁셋 윗줄 팁을 왼쪽(엄지)부터 둥근 네모 PNG 조각으로. 둥근 네모라 팁 밖으로 튀어나온 입체 장식도 산다 */
async function cutTips(set: Img): Promise<Buffer[]> {
  const tips = await segment(set.payload, 'press-on nail tip').catch(() => []);
  if (tips.length === 0) return [];
  const ys = tips.map((t) => center(t).y);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const oneRow = Math.max(...ys) - Math.min(...ys) < set.H * 0.1;
  const row = tips.filter((t) => oneRow || center(t).y <= mid).sort((a, b) => a.box.left - b.box.left).slice(0, 5);
  return Promise.all(
    row.map(async ({ box }) => {
      const w = box.right - box.left;
      const h = box.bottom - box.top;
      const r = Math.round(Math.min(w, h) * 0.2);
      const round = Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);
      return sharp(set.buf)
        .extract({ left: box.left, top: box.top, width: w, height: h })
        .composite([{ input: round, blend: 'dest-in' }])
        .png()
        .toBuffer();
    }),
  );
}

/** 조각들을 피부색 바탕에 나란히 — 실측상 '피부 위 팁'일 때 YouCam이 가장 충실히 옮긴다 */
async function layout(pieces: Buffer[]): Promise<ImagePayload> {
  const metas = await Promise.all(pieces.map((p) => sharp(p).metadata()));
  const maxW = Math.max(...metas.map((m) => m.width!));
  const maxH = Math.max(...metas.map((m) => m.height!));
  const gap = Math.round(maxW * 0.25);
  let x = gap;
  const layers = pieces.map((input, i) => {
    const l = { input, left: x, top: gap + Math.round((maxH - metas[i].height!) / 2) };
    x += metas[i].width! + gap;
    return l;
  });
  const out = await sharp({ create: { width: x, height: maxH + gap * 2, channels: 3, background: '#d8a98e' } })
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
  return { data: out.toString('base64'), mimeType: 'image/jpeg' };
}

/**
 * 손톱 5개를 엄지→새끼 순으로. 손등 사진에선 엄지 손톱이 가장 아래(중심 y 최대)에 있고 줄의 한쪽 끝이다.
 * ponytail: 손등이 위로 선 사진 가정. 손을 눕혀 찍으면 null → 1회 전송으로 대체
 */
function fingerOrder(nails: Segment[]): Segment[] | null {
  if (nails.length < 5) return null;
  const five = [...nails].sort((a, b) => area(b) - area(a)).slice(0, 5).sort((a, b) => center(a).x - center(b).x);
  const thumb = five.reduce((t, n) => (center(n).y > center(t).y ? n : t));
  if (thumb === five[0]) return five;
  if (thumb === five[4]) return five.reverse();
  return null;
}

async function transfer(srcId: string, ref: ImagePayload, W: number, H: number): Promise<Buffer> {
  const refId = await uploadImage(ref, 'design');
  const { url } = await runTask<{ url: string }>('ai-nail', { src_file_id: srcId, ref_file_id: refId });
  const out = await fetchImage(url);
  return sharp(Buffer.from(out.data, 'base64')).resize(W, H, { fit: 'fill' }).removeAlpha().jpeg({ quality: 95 }).toBuffer();
}

/**
 * k번째 결과에서 원래 k번째 손톱에 가장 가까운 손톱만 RGBA로.
 * YouCam이 팁을 못 알아보면(예: 입체 꽃이 팁을 덮음) 맨손톱 그대로 돌려준다 — 원본과 거의 같으면 null
 */
async function nailFrom(result: Buffer, original: Buffer, near: Segment, W: number, H: number): Promise<Buffer | null> {
  const found = await segment({ data: result.toString('base64'), mimeType: 'image/jpeg' }, 'fingernail');
  if (found.length === 0) return null;
  const c = center(near);
  const dist = (s: Segment) => Math.hypot(center(s).x - c.x, center(s).y - c.y);
  const pick = found.reduce((best, s) => (dist(s) < dist(best) ? s : best));
  const mask = await sharp(Buffer.from(mergeMasks([pick], W, H)), { raw: { width: W, height: H, channels: 1 } })
    .dilate(2)
    .blur(1.2)
    .extractChannel(0) // sharp가 중간에 3채널로 바꾼다 — 1채널로 되돌리지 않으면 행이 밀려 줄무늬
    .raw()
    .toBuffer();
  const [rgb, orig] = await Promise.all([sharp(result).raw().toBuffer(), sharp(original).raw().toBuffer()]);
  let diff = 0;
  let n = 0;
  for (let i = 0; i < W * H; i++) {
    if (mask[i] < 200) continue;
    n++;
    for (let c = 0; c < 3; c++) diff += Math.abs(rgb[i * 3 + c] - orig[i * 3 + c]);
  }
  // ponytail: 평균 채널 차이 12 미만 = '안 바뀜'. 은은한 누드 팁이 걸러지면 문턱을 낮출 것
  if (n === 0 || diff / (n * 3) < 12) return null;
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(mask, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();
}

export async function tryOn(hand: ImagePayload, tipSet: ImagePayload): Promise<ImagePayload> {
  if (isMock()) return hand;
  const [h, set] = await Promise.all([toJpeg(hand), toJpeg(tipSet)]);

  try {
    const [nails, tips, srcId] = await Promise.all([
      segment(h.payload, 'fingernail').catch(() => []),
      cutTips(set),
      uploadImage(h.payload, 'hand'),
    ]);
    const order = fingerOrder(nails);

    if (order && tips.length === 5) {
      // 바탕 = 세트 전체 1회 결과. 손가락별 전송이 실패한 손가락은 이 결과가 보인다 (맨손톱으로 남지 않게)
      const [base, ...layers] = await Promise.all([
        layout(tips).then((ref) => transfer(srcId, ref, h.W, h.H)),
        ...order.map(async (nail, k) => {
          const result = await transfer(srcId, await layout(Array(5).fill(tips[k])), h.W, h.H);
          return nailFrom(result, h.buf, nail, h.W, h.H);
        }),
      ]);
      const out = await sharp(base as Buffer)
        .composite(layers.filter((l): l is Buffer => !!l).map((input) => ({ input })))
        .jpeg({ quality: 90 })
        .toBuffer();
      return { data: out.toString('base64'), mimeType: 'image/jpeg' };
    }

    // 대체 경로: 손가락 순서를 못 정하면 1회 전송 (손가락별 정확도는 보장 안 됨)
    const ref = tips.length > 0 ? await layout(tips) : set.payload;
    const out = await transfer(srcId, ref, h.W, h.H);
    return { data: out.toString('base64'), mimeType: 'image/jpeg' };
  } catch (e) {
    if (e instanceof YouCamError && e.code === 'no_hand_detected') throw new NoNailsError();
    throw e;
  }
}
