/**
 * nail-masks.mts에 하드코딩한 타원 마스크가 실제 손톱판을 정확히 덮는지
 * 육안으로 확인하기 위한 디버그 오버레이 생성기.
 *   npx tsx scripts/debug-nail-masks.mts
 * hand.webp 위에 각 타원을 반투명 빨강 윤곽선+채움으로 그려 겹쳐 저장한다.
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NAIL_MASKS } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT = resolve(ROOT, 'ref/nail-candidates/mask-check.png');

async function run() {
  mkdirSync(dirname(OUT), { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  for (const m of NAIL_MASKS) {
    svg += `<g transform="rotate(${m.rotationDeg} ${m.cx} ${m.cy})">`;
    svg += `<ellipse cx="${m.cx}" cy="${m.cy}" rx="${m.rx}" ry="${m.ry}" fill="red" fill-opacity="0.35" stroke="red" stroke-width="2"/>`;
    svg += `</g>`;
    svg += `<text x="${m.cx - 15}" y="${m.cy + m.ry + 20}" font-size="16" fill="blue" font-weight="bold">${m.name}</text>`;
  }
  svg += `</svg>`;

  await sharp(SRC)
    .flatten({ background: '#f0ede8' })
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toFile(OUT);
  console.log('마스크 확인 이미지:', OUT);

  // 손끝 부분만 크게 잘라서도 저장 (세부 확인용)
  await sharp(OUT).extract({ left: 0, top: 0, width: W, height: 700 }).png()
    .toFile(resolve(ROOT, 'ref/nail-candidates/mask-check-top.png'));
}
run();
