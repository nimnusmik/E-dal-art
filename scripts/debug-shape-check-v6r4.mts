/**
 * 6r3 게이트(b) "마스크 실루엣이 실제 손톱의 길쭉한 형태와 일치 — 원이 아님"을
 * 육안으로 증명하기 위한 체크시트. debug-nail-masks-v6r2.mts와 달리 마스크
 * 오버레이를 원본 손(hand.webp)이 아니라 실제로 합성된 결과(v6r4-1.webp)
 * 위에 그린다 — 합성 텍스처(디자인) 경계가 트레이싱된 다각형 윤곽선과 얼마나
 * 일치하는지, 그리고 그 다각형이 원본 사진 속 손톱판의 실제 윤곽과 얼마나
 * 일치하는지를 한 시트에서 동시에 확인할 수 있게 한다.
 *
 * 손가락별로 3열: (1) 합성 결과 그대로, (2) 합성 결과 위에 트레이싱 다각형
 * 윤곽선(초록) 오버레이, (3) 원본 맨손 사진 위에 같은 윤곽선 오버레이(참고용,
 * 마스크가 실제 손톱판 경계와 얼마나 맞는지 별도 확인).
 *
 *   npx tsx scripts/debug-shape-check-v6r4.mts v6r4-1
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NAIL_MASKS, nailCropRect } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');

async function run() {
  const id = process.argv[2] || 'v6r4-1';
  mkdirSync(OUT_DIR, { recursive: true });
  const candPath = resolve(OUT_DIR, `${id}.webp`);
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (const m of NAIL_MASKS) {
    const pts = m.points.map((p) => `${p[0]},${p[1]}`).join(' ');
    svg += `<polygon points="${pts}" fill="none" stroke="#00ff40" stroke-width="1.6"/>`;
  }
  svg += `</svg>`;
  const outline = Buffer.from(svg);

  const flatHand = await sharp(SRC).flatten({ background: '#f0ede8' }).png().toBuffer();
  const flatCand = await sharp(candPath).flatten({ background: '#f0ede8' }).png().toBuffer();
  const handWithOutline = await sharp(flatHand).composite([{ input: outline }]).png().toBuffer();
  const candWithOutline = await sharp(flatCand).composite([{ input: outline }]).png().toBuffer();

  const ZOOM = 3;
  const labelH = 26;
  const rows: { name: string; cand: Buffer; candOutline: Buffer; handOutline: Buffer; w: number; h: number }[] = [];
  for (const m of NAIL_MASKS) {
    const rect = nailCropRect(m, W, H, 1.5, 20);
    const w = Math.round(rect.width * ZOOM), h = Math.round(rect.height * ZOOM);
    const cand = await sharp(flatCand).extract(rect).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    const candOutline = await sharp(candWithOutline).extract(rect).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    const handOutline = await sharp(handWithOutline).extract(rect).resize(w, h, { kernel: 'lanczos3' }).png().toBuffer();
    rows.push({ name: m.name, cand, candOutline, handOutline, w, h });
  }

  const colW = Math.max(...rows.map((r) => r.w));
  const rowH = Math.max(...rows.map((r) => r.h));
  const gap = 20;
  const sheetW = colW * 3 + gap * 2;
  const sheetH = (rowH + labelH) * rows.length;
  const composites: any[] = [];
  rows.forEach((r, i) => {
    const y = i * (rowH + labelH);
    composites.push({
      input: Buffer.from(`<svg width="${sheetW}" height="${labelH}"><rect width="100%" height="100%" fill="#141414"/><text x="10" y="19" font-size="17" fill="white" font-family="sans-serif">${r.name} — 좌: 합성 결과(윤곽선 없음) / 중: 합성 결과+트레이싱 윤곽선(초록) / 우: 원본 맨손+같은 윤곽선</text></svg>`),
      left: 0,
      top: y,
    });
    composites.push({ input: r.cand, left: 0, top: y + labelH });
    composites.push({ input: r.candOutline, left: colW + gap, top: y + labelH });
    composites.push({ input: r.handOutline, left: (colW + gap) * 2, top: y + labelH });
  });

  await sharp({ create: { width: sheetW, height: sheetH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } })
    .composite(composites)
    .png()
    .toFile(resolve(OUT_DIR, 'v6r4-shape-check.png'));
  console.log('저장 완료:', resolve(OUT_DIR, 'v6r4-shape-check.png'));
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
