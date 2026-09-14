/**
 * favicon / OG 이미지 / 모바일용 히어로 배경을 생성한다.
 *   npx tsx scripts/make-brand-assets.ts
 *
 * - app/icon.png, app/apple-icon.png : 갤러리 시안을 정사각 크롭 (Next App Router 관례)
 * - public/og.jpg                    : 1200x630 카톡·인스타 공유 카드
 * - public/landing/meadow-mobile.jpg : 390px DPR3(=1170px) 전용본. 원본 2000px은 모바일에 과대
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = process.cwd();
const GALLERY = path.join(ROOT, 'public/gallery/pastel-french.jpg');
const MEADOW = path.join(ROOT, 'public/landing/meadow.jpg');

async function icons() {
  for (const [file, size] of [
    ['app/icon.png', 512],
    ['app/apple-icon.png', 180],
  ] as const) {
    const buf = await sharp(GALLERY)
      .resize(size, size, { fit: 'cover', position: 'center' })
      .png({ compressionLevel: 9, palette: true, quality: 88 })
      .toBuffer();
    await writeFile(path.join(ROOT, file), buf);
    console.log(`✓ ${file} (${size}px, ${buf.length}B)`);
  }
}

async function og() {
  // 초원 배경 위에 시안 카드를 얹은 1200x630. 텍스트는 폰트 의존을 피하려고 SVG로 그린다.
  const bg = await sharp(MEADOW).resize(1200, 630, { fit: 'cover', position: 'center' }).toBuffer();
  const card = await sharp(GALLERY)
    .resize(420, 420, { fit: 'cover' })
    .composite([
      {
        input: Buffer.from(
          `<svg width="420" height="420"><rect width="420" height="420" rx="24" fill="#fff"/></svg>`,
        ),
        blend: 'dest-in',
      },
    ])
    .png()
    .toBuffer();

  const overlay = Buffer.from(`
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <rect width="1200" height="630" fill="rgba(16,26,44,0.42)"/>
      <text x="80" y="268" font-family="sans-serif" font-size="78" font-weight="900" fill="#ffffff">사진 한 장이</text>
      <text x="80" y="362" font-family="sans-serif" font-size="78" font-weight="900" fill="#ffffff">이달의 네일이 돼요</text>
      <text x="80" y="428" font-family="sans-serif" font-size="30" font-weight="600" fill="rgba(255,255,255,0.92)">이달아 · 가입 없이 무료</text>
    </svg>
  `);

  const buf = await sharp(bg)
    .composite([
      { input: overlay, top: 0, left: 0 },
      { input: card, top: 105, left: 700 },
    ])
    .jpeg({ quality: 84, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(ROOT, 'public/og.jpg'), buf);
  console.log(`✓ public/og.jpg (1200x630, ${buf.length}B)`);
}

async function meadowMobile() {
  const buf = await sharp(MEADOW)
    .resize(1170, null, { fit: 'inside' })
    .jpeg({ quality: 78, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(ROOT, 'public/landing/meadow-mobile.jpg'), buf);
  console.log(`✓ public/landing/meadow-mobile.jpg (1170px, ${buf.length}B)`);
}

async function main() {
  await mkdir(path.join(ROOT, 'public/landing'), { recursive: true });
  await icons();
  await og();
  await meadowMobile();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
