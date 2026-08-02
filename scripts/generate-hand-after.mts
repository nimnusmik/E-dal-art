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
  const width = right - left + 1;
  const height = bottom - top + 1;
  return { left, top, right, bottom, width, height, cx: left + width / 2, cy: top + height / 2 };
}

/**
 * 자동 정렬 보정 — 일관된 평행이동/스케일 오차 교정.
 * 생성본의 알파 바운딩박스 중심을 원본 바운딩박스 중심에 맞추고,
 * 바운딩박스 크기 차이가 3% 이상이면 그 비율만큼 리사이즈도 함께 적용한다.
 */
async function alignToOriginal(rgba: Buffer, origAlpha: Buffer, W: number, H: number): Promise<Buffer> {
  const bboxOrig = alphaBBox(origAlpha, W, H);
  const bboxGen = alphaBBox(rgba, W, H);

  const scaleX = bboxOrig.width / bboxGen.width;
  const scaleY = bboxOrig.height / bboxGen.height;
  const needsScale = Math.abs(scaleX - 1) >= 0.03 || Math.abs(scaleY - 1) >= 0.03;

  let genBuf = rgba;
  let genW = W, genH = H;
  let genCx = bboxGen.cx, genCy = bboxGen.cy;

  if (needsScale) {
    genW = Math.round(W * scaleX);
    genH = Math.round(H * scaleY);
    genBuf = await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
      .resize(genW, genH, { fit: 'fill' })
      .raw().toBuffer();
    genCx = bboxGen.cx * scaleX;
    genCy = bboxGen.cy * scaleY;
    console.log(`정렬 보정: 스케일 X=${scaleX.toFixed(3)} Y=${scaleY.toFixed(3)}`);
  }

  const dx = Math.round(bboxOrig.cx - genCx);
  const dy = Math.round(bboxOrig.cy - genCy);
  console.log(`정렬 보정: 평행이동 dx=${dx} dy=${dy}`);

  if (dx === 0 && dy === 0 && !needsScale) return rgba; // 보정 불필요

  // 음수 오프셋·스케일로 인한 캔버스 밖 넘침을 처리하기 위해 여유 있는 캔버스에 배치 후 크롭
  // (sharp는 composite 직후 같은 파이프라인에서 extract를 체이닝하지 못해 PNG로 한 번 구체화한다)
  const margin = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(genW - W), Math.abs(genH - H))) + 16;
  const composited = await sharp({
    create: { width: W + margin * 2, height: H + margin * 2, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: genBuf, raw: { width: genW, height: genH, channels: 4 }, left: margin + dx, top: margin + dy, blend: 'over' }])
    .png().toBuffer();
  const canvas = await sharp(composited)
    .extract({ left: margin, top: margin, width: W, height: H })
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

  // 키아웃 → 트림 없이 원본 크기로 강제(정렬 보존)
  const gen = sharp(Buffer.from(outcome.image.data, 'base64')).resize(W, H, { fit: 'fill' });
  const { data, info } = await gen.raw().toBuffer({ resolveWithObject: true });
  const rgbaRaw = keyOutGreen(data, info.width, info.height, info.channels);

  // 자동 정렬 보정 — 원본(hand.webp) 알파 바운딩박스에 생성본 바운딩박스 중심/크기를 맞춤
  const { data: origAlpha } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = await alignToOriginal(rgbaRaw, origAlpha, W, H);

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
