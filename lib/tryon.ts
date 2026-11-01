import sharp from 'sharp';
import { fetchImage, runTask, uploadImage, YouCamError } from './youcam';
import { isMock } from './mock';
import { mergeMasks, segment, type Segment } from './sam';
import type { ImagePayload } from './types';

/**
 * 내 손에 입혀보기 — 사용자 손 사진 + 고른 팁셋 → 손톱만 바뀐 사진.
 * YouCam AI Nail Transfer(1 unit/회): 손 사진(src)에 참고 사진(ref)의 네일 디자인을 옮긴다.
 * 손톱 찾기·합성을 YouCam이 다 해서, 예전 SAM 마스크 + Muse 합성(main 브랜치)이 필요 없다.
 */

export class NoNailsError extends Error {}

/**
 * 팁셋 사진 → YouCam 참고 사진: SAM으로 팁을 하나씩 오려 윗줄 5개를 피부색 바탕에 나란히.
 * 실측(2026-11-01): 팁셋 원본(스탠드·그림자 실사)을 그대로 넘기면 손가락마다 디자인이 뒤섞이고,
 * 'AI 착용샷'은 디자인 자체가 바뀌어 와서 못 씀. 깨끗한 '피부 위 팁 5개'가 가장 충실하게 옮겨졌다.
 * SAM이 팁을 못 찾으면 원본을 그대로 넘긴다 (품질은 떨어져도 입혀보기는 동작).
 */
export async function buildReference(tipSet: ImagePayload): Promise<ImagePayload> {
  const src = await sharp(Buffer.from(tipSet.data, 'base64')).rotate().removeAlpha().jpeg().toBuffer();
  const { width: W, height: H } = (await sharp(src).metadata()) as { width: number; height: number };
  const img = { data: src.toString('base64'), mimeType: 'image/jpeg' };
  const tips = await segment(img, 'press-on nail tip').catch(() => []);
  if (tips.length < 3) return img;

  // 윗줄 = 중심 y가 전체 위아래 중간보다 위인 팁 (팁셋은 1~2줄)
  const cy = (t: Segment) => (t.box.top + t.box.bottom) / 2;
  const ys = tips.map(cy);
  const mid = (Math.min(...ys) + Math.max(...ys)) / 2;
  const top = tips.filter((t) => cy(t) <= mid || ys.every((y) => Math.abs(y - ys[0]) < H * 0.1));
  const row = top.sort((a, b) => a.box.left - b.box.left).slice(0, 5);

  // 팁마다 마스크로 오려 낸 RGBA 조각
  const pieces = await Promise.all(
    row.map(async (t) => {
      const { left, top: y, right, bottom } = t.box;
      const w = right - left;
      const h = bottom - y;
      // 네모 칸 통째 (둥근 모서리) — 팁 밖으로 튀어나온 입체 장식까지 살린다
      const r = Math.round(Math.min(w, h) * 0.2);
      const mask = await sharp(Buffer.from(`<svg width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`))
        .extractChannel(0)
        .raw()
        .toBuffer();
      const rgb = await sharp(src).extract({ left, top: y, width: w, height: h }).raw().toBuffer();
      const png = await sharp(rgb, { raw: { width: w, height: h, channels: 3 } })
        .joinChannel(mask, { raw: { width: w, height: h, channels: 1 } })
        .png()
        .toBuffer();
      return { png, w, h };
    }),
  );
  const gap = Math.round(Math.max(...pieces.map((p) => p.w)) * 0.25);
  const maxH = Math.max(...pieces.map((p) => p.h));
  const cw = pieces.reduce((a, p) => a + p.w + gap, gap);
  const ch = maxH + gap * 2;
  let x = gap;
  const layers = pieces.map((p) => {
    const l = { input: p.png, left: x, top: gap + Math.round((maxH - p.h) / 2) };
    x += p.w + gap;
    return l;
  });
  const out = await sharp({ create: { width: cw, height: ch, channels: 3, background: '#d8a98e' } })
    .composite(layers)
    .jpeg({ quality: 92 })
    .toBuffer();
  return { data: out.toString('base64'), mimeType: 'image/jpeg' };
}

export async function tryOn(hand: ImagePayload, tipSet: ImagePayload): Promise<ImagePayload> {
  if (isMock()) return hand;

  const [src_file_id, ref_file_id] = await Promise.all([uploadImage(hand, 'hand'), uploadImage(await buildReference(tipSet), 'design')]);
  try {
    const { url } = await runTask<{ url: string }>('ai-nail', { src_file_id, ref_file_id });
    return await fetchImage(url);
  } catch (e) {
    if (e instanceof YouCamError && e.code === 'no_hand_detected') throw new NoNailsError();
    throw e;
  }
}
