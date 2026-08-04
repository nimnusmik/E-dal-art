/**
 * nail-masks.mts의 다각형 마스크가 실제 손톱판을 정확히 덮는지 육안으로
 * 확인하기 위한 디버그 오버레이 생성기.
 *   npx tsx scripts/debug-nail-masks.mts
 * hand.webp 위에 각 다각형을 반투명 빨강 윤곽선+채움으로 그려 겹친 전체
 * 이미지에 더해, 손가락별 2배 확대 크롭 5장을 저장해 큐티클 라인·측벽까지
 * 정확히 맞는지(그리고 피부 쪽으로 새지 않는지) 확대 검수할 수 있게 한다.
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NAIL_MASKS, nailCropRect } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');
const OUT = resolve(OUT_DIR, 'mask-check.png');

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (const m of NAIL_MASKS) {
    const pts = m.points.map((p) => `${p[0]},${p[1]}`).join(' ');
    svg += `<polygon points="${pts}" fill="red" fill-opacity="0.35" stroke="red" stroke-width="1.5"/>`;
    svg += `<text x="${m.cx - 15}" y="${m.cy - m.ry - 8}" font-size="16" fill="blue" font-weight="bold">${m.name}</text>`;
  }
  svg += `</svg>`;

  const overlay = Buffer.from(svg);
  await sharp(SRC)
    .flatten({ background: '#f0ede8' })
    .composite([{ input: overlay }])
    .png()
    .toFile(OUT);
  console.log('마스크 확인 이미지(전체):', OUT);

  // 손끝 부분만 크게 잘라서도 저장 (세부 확인용)
  await sharp(OUT).extract({ left: 0, top: 0, width: W, height: 700 }).png()
    .toFile(resolve(OUT_DIR, 'mask-check-top.png'));

  // 게이트1(모양) 검증용: 손가락별 2배 확대 크롭(오버레이 있는 버전 +
  // 오버레이 없는 원본 버전을 나란히) — 다섯 손가락을 이어 붙인 시트 하나로 저장.
  const flatSrc = await sharp(SRC).flatten({ background: '#f0ede8' }).png().toBuffer();
  const withOverlay = await sharp(flatSrc).composite([{ input: overlay }]).png().toBuffer();

  const ZOOM = 2;
  const labelH = 24;
  const crops: { name: string; plain: Buffer; overlaid: Buffer; w: number; h: number }[] = [];
  for (const m of NAIL_MASKS) {
    const rect = nailCropRect(m, W, H, 1.5, 20);
    const plain = await sharp(flatSrc).extract(rect).resize(rect.width * ZOOM, rect.height * ZOOM, { kernel: 'lanczos3' }).png().toBuffer();
    const overlaid = await sharp(withOverlay).extract(rect).resize(rect.width * ZOOM, rect.height * ZOOM, { kernel: 'lanczos3' }).png().toBuffer();
    crops.push({ name: m.name, plain, overlaid, w: rect.width * ZOOM, h: rect.height * ZOOM });
  }

  const colW = Math.max(...crops.map((c) => c.w));
  const rowH = Math.max(...crops.map((c) => c.h));
  const sheetW = colW * 2 + 20; // plain | overlaid
  const sheetH = (rowH + labelH) * crops.length;
  const composites: any[] = [];
  crops.forEach((c, i) => {
    const y = i * (rowH + labelH);
    composites.push({ input: Buffer.from(`<svg width="${sheetW}" height="${labelH}"><rect width="100%" height="100%" fill="#141414"/><text x="10" y="18" font-size="18" fill="white" font-family="sans-serif">${c.name} — 왼쪽: 원본(마스크 없음) / 오른쪽: 다각형 마스크 오버레이 (2x 확대)</text></svg>`), left: 0, top: y });
    composites.push({ input: c.plain, left: 0, top: y + labelH });
    composites.push({ input: c.overlaid, left: colW + 20, top: y + labelH });
  });
  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(resolve(OUT_DIR, 'v6-shape-check.png'));
  console.log('게이트1 확인용 손가락별 확대 시트:', resolve(OUT_DIR, 'v6-shape-check.png'));
}
run();
