/**
 * 히어로 아래 "영감→시안 비포/애프터" 슬라이더용 이미지 쌍 생성 (일회성, 산출물 커밋).
 *   npx tsx scripts/generate-hero-beforeafter.mts
 * before = 파일럿 영감 사진 1장, after = 실제 파이프라인(buildPrompt)으로 생성한 네일 착용 시안.
 * 두 이미지는 슬라이더가 자연스럽도록 동일 800×1000(4:5)로 크롭.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateImage } from '../lib/provider.ts';
import { buildPrompt } from '../lib/prompt.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'pilot/_ (12).jpeg'); // 몽환 파스텔
const OUT_BEFORE = resolve(ROOT, 'public/hero/ba-before.webp');
const OUT_AFTER = resolve(ROOT, 'public/hero/ba-after.webp');
const BOX = { w: 800, h: 1000 } as const;

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

async function run() {
  mkdirSync(dirname(OUT_BEFORE), { recursive: true });

  // before — 파일럿 영감 사진을 4:5로 크롭
  const srcBuf = readFileSync(SRC);
  await sharp(srcBuf).resize(BOX.w, BOX.h, { fit: 'cover', position: 'attention' }).webp({ quality: 86 }).toFile(OUT_BEFORE);
  console.log('생성: ba-before.webp');

  // after — 실제 생성 파이프라인으로 네일 착용 시안 (영감 사진 입력)
  const inputB64 = srcBuf.toString('base64');
  const prompt = buildPrompt('almond', 'medium', [], 1, false);
  console.log('시안 생성 중… (공급자:', process.env.IMAGE_PROVIDER ?? 'gemini', ')');
  const outcome = await generateImage([{ data: inputB64, mimeType: 'image/jpeg' }], prompt);
  if (outcome.safetyBlocked) throw new Error('세이프티 차단됨 — 다른 영감 사진으로 시도');
  if (!outcome.image) throw new Error('시안 이미지가 반환되지 않음');
  await sharp(Buffer.from(outcome.image.data, 'base64'))
    .resize(BOX.w, BOX.h, { fit: 'cover', position: 'attention' })
    .webp({ quality: 88 })
    .toFile(OUT_AFTER);
  console.log('생성: ba-after.webp');
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
