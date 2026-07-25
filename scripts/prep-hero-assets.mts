/**
 * 히어로 개편용 정적 에셋 생성 (일회성, 산출물은 커밋).
 *   npx tsx scripts/prep-hero-assets.mts
 * 산출물: public/hero/insp/*.webp (320px 정사각), public/hero/hand.webp (플레이스홀더)
 */
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT = resolve(ROOT, 'pilot');
const INSP_DIR = resolve(ROOT, 'public/hero/insp');
const HAND = resolve(ROOT, 'public/hero/hand.webp');

// 파일럿 원본 → 산출물명 매핑 (라벨은 heroInspo.ts에서 관리)
const MAP: Array<[string, string]> = [
  ['_ (9).jpeg', 'tattoo.webp'],
  ['_ (12).jpeg', 'dreamy.webp'],
  ['_ (13).jpeg', 'fairycore.webp'],
  ['_ (14).jpeg', 'wings.webp'],
];

async function run() {
  mkdirSync(INSP_DIR, { recursive: true });
  for (const [src, out] of MAP) {
    const from = resolve(PILOT, src);
    if (!existsSync(from)) throw new Error(`원본 없음: ${from}`);
    await sharp(from)
      .resize(320, 320, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(resolve(INSP_DIR, out));
    console.log('생성:', out);
  }

  // 손 플레이스홀더 — 크림 배경 위 부드러운 실루엣 블록 (AI 실사로 교체 예정)
  const placeholder = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800">
       <rect width="640" height="800" fill="#fcfaf7"/>
       <rect x="180" y="120" width="280" height="560" rx="140"
             fill="#efe9e0" stroke="rgba(26,24,21,0.14)" stroke-width="1"/>
       <text x="320" y="410" text-anchor="middle" font-family="serif"
             font-size="26" fill="#8a837a">HAND</text>
     </svg>`,
  );
  await sharp(placeholder).webp({ quality: 82 }).toFile(HAND);
  console.log('생성: hand.webp (플레이스홀더)');
}
run().catch((e) => { console.error(e); process.exit(1); });
