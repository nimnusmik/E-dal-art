/**
 * 히어로 중심 "제시하는 맨손" 이미지 생성 (일회성, 산출물 커밋).
 *   npx tsx scripts/generate-hero-hand.mts
 * 산출물: public/hero/hand.webp (세로 크롭, 손목 아래 페이드 느낌은 크롭으로 유도)
 *
 * 손은 이미지 모델이 자주 틀리므로, 마음에 안 들면 재실행하여 여러 후보를 비교하세요.
 * --keep 로 실행하면 기존 hand.webp를 hand-prev.webp로 백업합니다.
 */
import { readFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/hero/hand.webp');

// .env.local 수동 로드 (tsx는 자동 로드하지 않음)
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
// 실호출 강제 — .env.local의 개발용 목 플래그가 섞이지 않게
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

const PROMPT = [
  'A single elegant bare female hand, back of the hand facing the camera,',
  'fingers gently spread in a graceful presenting gesture.',
  'Natural short clean fingernails with NO nail art and NO polish, bare nails.',
  'Smooth skin, soft diffused natural studio light, subtle soft shadow.',
  'Seamless warm cream background, color #fcfaf7, no props.',
  'Minimal editorial fashion photography, vertical portrait composition,',
  'wrist fading softly out of the frame at the bottom.',
  'Photorealistic, high detail, no jewelry, no text, no watermark.',
].join(' ');

async function run() {
  mkdirSync(dirname(OUT), { recursive: true });
  if (existsSync(OUT) && process.argv.includes('--keep')) {
    copyFileSync(OUT, resolve(ROOT, 'public/hero/hand-prev.webp'));
    console.log('기존 이미지 백업: hand-prev.webp');
  }

  // Seedream(Ark) 텍스트→이미지 직접 호출 — 편집용 callSeedream과 달리 image 필드 없이 size 지정
  const base = process.env.SEEDREAM_BASE_URL ?? 'https://ark.ap-southeast.bytepluses.com/api/v3';
  const model = process.env.SEEDREAM_MODEL ?? 'seedream-4-0';
  console.log('손 이미지 생성 중… (Ark 텍스트→이미지, 모델:', model, ')');
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.SEEDREAM_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      model,
      prompt: PROMPT,
      size: '1728x2304', // 세로 3:4, Ark 최소 픽셀(≈3.69MP) 충족
      response_format: 'b64_json',
      watermark: false,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ark ${res.status}: ${body.slice(0, 400)}`);
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('이미지가 반환되지 않음: ' + JSON.stringify(json).slice(0, 300));

  const raw = Buffer.from(b64, 'base64');
  // 세로 3:4 크롭 + webp 변환 (레이아웃 슬롯 640×800에 맞춤)
  await sharp(raw)
    .resize(640, 800, { fit: 'cover', position: 'attention' })
    .webp({ quality: 88 })
    .toFile(OUT);
  console.log('생성 완료:', OUT);
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
