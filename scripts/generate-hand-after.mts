/**
 * 히어로 "변신 후 손" 생성 (일회성, 산출물 커밋).
 *   npx tsx scripts/generate-hand-after.mts
 * hand.webp(맨손)를 입력으로 같은 손·같은 포즈에 손톱 디자인만 얹은 이미지를 생성.
 * 크로마 그린으로 플래튼해 보내고, 결과를 키아웃한 뒤 **트림 없이** 원본과
 * 같은 1000×1796으로 저장해 픽셀 정렬을 보존한다.
 * 정렬 검증용 오버레이(ref/hand-after-check.png)를 함께 만든다 — 손 외곽이
 * 이중으로 보이면 재실행.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateImage } from '../lib/provider.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT = resolve(ROOT, 'public/hero/hand-after.webp');
const CHECK = resolve(ROOT, 'ref/hand-after-check.png');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

// 트렌드는 질감·효과로만 서술(음식·파츠 명사 금지) — 2026-07-31 품질 규칙
const PROMPT = [
  'Edit this photo of a bare hand on a green screen background.',
  'Keep EVERYTHING pixel-identical: same hand, same pose, same finger positions,',
  'same skin tone, same lighting, same framing, same solid green background.',
  "Only change: apply this month's K-nail trend design to the five fingernails —",
  'glazed glossy sheen, soft chrome shimmer, subtle aurora film gradient in muted pastel tones.',
  'Nails keep their natural short length and stay naturally attached to the fingers.',
  'Banned: 3D food charms (donut, candy, cake, fruit), ribbon bows, dangling charms,',
  'oversized 3D parts, cartoon characters, text, watermark, jewelry.',
  'Photorealistic, high detail.',
].join(' ');

/** generate-hero-hand.mts와 동일한 크로마 그린 키아웃 (일회성 스크립트라 복사 유지) */
function keyOutGreen(raw: Buffer, w: number, h: number, channels: number): Buffer {
  const HI = 45, LO = 12;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * channels;
    let r = raw[p], g = raw[p + 1], b = raw[p + 2];
    const gm = g - Math.max(r, b);
    let a: number;
    if (gm >= HI) a = 0;
    else if (gm <= LO) a = 255;
    else a = Math.round((255 * (HI - gm)) / (HI - LO));
    const maxRB = Math.max(r, b);
    if (g > maxRB) g = maxRB;
    if (a === 0) { r = 0; g = 0; b = 0; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return out;
}

/** RGBA 버퍼(alpha>128을 불투명으로 간주)의 바운딩박스와 중심을 구한다 — 정렬 보정용 */
function alphaBBox(rgba: Buffer, w: number, h: number) {
  let left = w, right = -1, top = h, bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = rgba[(y * w + x) * 4 + 3];
      if (a > 128) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  // 퇴화 가드: 유효 알파 픽셀이 하나도 없으면(right가 갱신 안 됨) 명확히 실패시킨다
  if (right < 0 || bottom < 0) {
    throw new Error('생성본에서 유효한 알파 영역을 찾지 못함 — 재실행');
  }
  const width = right - left + 1;
  const height = bottom - top + 1;
  return { left, top, right, bottom, width, height, cx: left + width / 2, cy: top + height / 2 };
}

/**
 * 알파 전이(0<a<255) 픽셀 비율 — 키아웃 경계가 얼마나 부드러운지의 대략적 지표.
 * 리사이즈로 얇은 알파 램프가 0/255로 붕괴하면 이 값이 원본 대비 크게 낮아진다.
 */
function softEdgeRatio(rgba: Buffer, w: number, h: number): number {
  let soft = 0, opaque = 0;
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3];
    if (a > 0 && a < 255) soft++;
    else if (a >= 128) opaque++;
  }
  return soft / Math.max(opaque, 1);
}

/**
 * 정렬 보정량(스케일·평행이동) 계산 — 원본(hand.webp)과 생성본의 알파 바운딩박스를 비교한다.
 * 스케일이 25%를 넘어서면(비율 왜곡 위험) 콘솔에 경고만 남기고 중단하지 않는다 — 최종 판단은 게이트(육안 확인)에서.
 */
function computeAlignment(bboxOrig: ReturnType<typeof alphaBBox>, bboxGen: ReturnType<typeof alphaBBox>, W: number, H: number) {
  const scaleX = bboxOrig.width / bboxGen.width;
  const scaleY = bboxOrig.height / bboxGen.height;
  if (Math.abs(scaleX - 1) > 0.25 || Math.abs(scaleY - 1) > 0.25) {
    console.warn(`경고: 큰 기하 보정(X ${scaleX.toFixed(2)} Y ${scaleY.toFixed(2)}) 적용됨 — 비율 왜곡 여부를 게이트에서 반드시 확인`);
  }
  const needsScale = Math.abs(scaleX - 1) >= 0.03 || Math.abs(scaleY - 1) >= 0.03;
  const genW = needsScale ? Math.round(W * scaleX) : W;
  const genH = needsScale ? Math.round(H * scaleY) : H;
  const genCx = needsScale ? bboxGen.cx * scaleX : bboxGen.cx;
  const genCy = needsScale ? bboxGen.cy * scaleY : bboxGen.cy;
  const dx = Math.round(bboxOrig.cx - genCx);
  const dy = Math.round(bboxOrig.cy - genCy);
  return { scaleX, scaleY, needsScale, genW, genH, dx, dy };
}

/**
 * 자동 정렬 보정 — **키아웃 전** 그린 배경 RGB에 스케일·평행이동을 적용한다.
 * (얇은 알파 램프에 비균등 리사이즈를 하면 램프가 0/255로 붕괴해 외곽이 계단져 보이는
 * 문제가 있어, 키아웃을 보정 이후로 미루고 그린 배경 위에서만 지오메트리를 바꾼다.)
 * 보정 후에는 원본 크기(W×H)의 그린 배경 RGB 버퍼(채널 수는 입력과 동일)를 반환한다.
 */
async function alignGreenBackground(
  greenRaw: Buffer, W: number, H: number, channels: 1 | 2 | 3 | 4,
  align: ReturnType<typeof computeAlignment>,
): Promise<Buffer> {
  const { needsScale, genW, genH, dx, dy } = align;
  if (dx === 0 && dy === 0 && !needsScale) return greenRaw; // 보정 불필요

  let genBuf = greenRaw;
  if (needsScale) {
    // lanczos3(리사이즈 기본값)을 명시 — 큰 배율 보정에서도 부드러운 리샘플링을 보장
    genBuf = await sharp(greenRaw, { raw: { width: W, height: H, channels } })
      .resize(genW, genH, { fit: 'fill', kernel: 'lanczos3' })
      .raw().toBuffer();
  }

  // 음수 오프셋·스케일로 인한 캔버스 밖 넘침을 처리하기 위해 여유 있는 캔버스에 배치 후 크롭.
  // 캔버스 배경은 (알파가 아직 없는) 크로마 그린 그대로 채워, 나중에 한 번만 키아웃할 때
  // 여백도 자연스럽게 투명 처리되도록 한다(검정 투명 픽셀 블리딩 없음).
  const margin = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(genW - W), Math.abs(genH - H))) + 16;
  // sharp 0.35는 composite 직후 같은 파이프라인에서 extract를 체이닝하면
  // "Image to composite must have same dimensions or smaller" 오류를 내므로,
  // PNG로 한 번 구체화(toBuffer)한 뒤 새 sharp 인스턴스로 extract한다.
  const composited = await sharp({
    create: { width: W + margin * 2, height: H + margin * 2, channels: channels as 3 | 4, background: { r: 0, g: 177, b: 64 } },
  })
    .composite([{ input: genBuf, raw: { width: genW, height: genH, channels }, left: margin + dx, top: margin + dy, blend: 'over' }])
    .png().toBuffer();
  // sharp composite()는 입력이 모두 알파 없는 3채널이어도 결과에 알파 채널을 자동으로 붙인다.
  // 그대로 두면 아래에서 채널 수(channels=3 가정)와 실제 버퍼 스트라이드가 어긋나
  // keyOutGreen이 픽셀을 잘못된 오프셋으로 읽어 이미지가 깨진다 — removeAlpha로 되돌린다.
  const canvas = await sharp(composited)
    .extract({ left: margin, top: margin, width: W, height: H })
    .removeAlpha()
    .raw().toBuffer();
  return canvas;
}

async function run() {
  mkdirSync(dirname(CHECK), { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!; // 1000×1796

  // 알파 → 크로마 그린 플래튼 (모델 입력용)
  const flat = await sharp(SRC).flatten({ background: { r: 0, g: 177, b: 64 } }).png().toBuffer();
  console.log('변신 후 손 생성 중… (공급자:', process.env.IMAGE_PROVIDER ?? 'gemini', ')');
  const outcome = await generateImage([{ data: flat.toString('base64'), mimeType: 'image/png' }], PROMPT);
  if (outcome.safetyBlocked) throw new Error('세이프티 차단됨 — 재실행');
  if (!outcome.image) throw new Error('이미지가 반환되지 않음');

  // 트림 없이 원본 크기로 강제(정렬 보존) — 그린 배경 RGB 상태로 유지(키아웃은 보정 후 1회만)
  const gen = sharp(Buffer.from(outcome.image.data, 'base64')).removeAlpha().resize(W, H, { fit: 'fill' });
  const { data: greenRaw, info } = await gen.raw().toBuffer({ resolveWithObject: true });

  // 1) bbox 측정 전용 임시 키아웃(버림) — 정렬량 계산에만 사용
  const tempAlpha = keyOutGreen(greenRaw, info.width, info.height, info.channels);
  const { data: origAlpha } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bboxOrig = alphaBBox(origAlpha, W, H);
  const bboxGen = alphaBBox(tempAlpha, W, H);
  const align = computeAlignment(bboxOrig, bboxGen, W, H);
  if (align.needsScale) console.log(`정렬 보정: 스케일 X=${align.scaleX.toFixed(3)} Y=${align.scaleY.toFixed(3)}`);
  console.log(`정렬 보정: 평행이동 dx=${align.dx} dy=${align.dy}`);

  // 2) 키아웃 전 그린 배경 RGB에 보정 적용 → 3) 보정된 지오메트리에 키아웃 최종 1회 적용(신선한 알파 램프)
  const alignedGreen = await alignGreenBackground(greenRaw, W, H, info.channels as 1 | 2 | 3 | 4, align);
  const rgba = keyOutGreen(alignedGreen, W, H, info.channels);

  const softAfter = softEdgeRatio(rgba, W, H);
  const softOrig = softEdgeRatio(origAlpha, W, H);
  console.log(`알파 전이 비율 — 원본=${softOrig.toFixed(4)} 생성본=${softAfter.toFixed(4)} (생성본이 원본 대비 크게 낮으면 외곽 계단 현상 의심 → 핑거팁 확대 육안 확인 필요)`);

  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(OUT);
  console.log('생성 완료:', OUT);

  // 정렬 검증 오버레이 — 원본 위에 결과를 55% 불투명도로 겹침
  const after = await sharp(OUT).ensureAlpha().png().toBuffer();
  const ghost = await sharp(after)
    .composite([{ input: Buffer.from([255, 255, 255, 115]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
    .png().toBuffer();
  await sharp(SRC).ensureAlpha()
    .composite([{ input: ghost, blend: 'over' }])
    .flatten({ background: '#fcfaf7' })
    .png().toFile(CHECK);
  console.log('정렬 검증 이미지:', CHECK, '(손 외곽이 이중으로 보이면 재실행)');
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
