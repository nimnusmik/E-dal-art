/**
 * 게이트 검수용: 합성된 v6r 후보(v6r-1.webp / v6r-2.webp)를 손가락별로 3배
 * 확대해 나란히 붙인 시트를 만든다(오버레이 없음, 합성 결과 자체를 그대로
 * 확대) — v6-1/v6-2-fingertip-zoom.png와 동일한 레이아웃.
 *   npx tsx scripts/fingertip-zoom-v6r.mts v6r-1
 *   npx tsx scripts/fingertip-zoom-v6r.mts v6r-2
 */
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NAIL_MASKS, nailCropRect } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');

async function run() {
  const id = process.argv[2];
  if (!id) throw new Error('사용법: npx tsx scripts/fingertip-zoom-v6r.mts <v6r-1|v6r-2>');
  const src = resolve(OUT_DIR, `${id}.webp`);
  const meta = await sharp(src).metadata();
  const W = meta.width!, H = meta.height!;
  const flatSrc = await sharp(src).flatten({ background: '#f0ede8' }).png().toBuffer();

  const ZOOM = 3;
  const labelH = 24;
  const crops: { name: string; buf: Buffer; w: number; h: number }[] = [];
  for (const m of NAIL_MASKS) {
    const rect = nailCropRect(m, W, H, 1.4, 16);
    const buf = await sharp(flatSrc).extract(rect).resize(rect.width * ZOOM, rect.height * ZOOM, { kernel: 'lanczos3' }).png().toBuffer();
    crops.push({ name: m.name, buf, w: rect.width * ZOOM, h: rect.height * ZOOM });
  }

  const rowH = Math.max(...crops.map((c) => c.h));
  const sheetW = crops.reduce((s, c) => s + c.w, 0);
  const sheetH = rowH + labelH;
  const composites: any[] = [];
  let x = 0;
  for (const c of crops) {
    composites.push({ input: Buffer.from(`<svg width="${c.w}" height="${labelH}"><rect width="100%" height="100%" fill="#141414"/><text x="10" y="18" font-size="18" fill="white" font-family="sans-serif">${c.name}</text></svg>`), left: x, top: 0 });
    composites.push({ input: c.buf, left: x, top: labelH });
    x += c.w;
  }
  const out = resolve(OUT_DIR, `${id}-fingertip-zoom.png`);
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(out);
  console.log('손가락별 확대 시트 저장:', out);
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
