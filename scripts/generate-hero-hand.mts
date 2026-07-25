/**
 * 히어로 중심 "제시하는 맨손" 이미지 생성 + 배경 누끼(투명 처리).
 *   npx tsx scripts/generate-hero-hand.mts
 * 흰 배경으로 생성 → 테두리에서 플러드필로 흰 영역만 투명 처리(손톱 내부 하이라이트는 보존)
 * → 여백 트림 → 투명 webp 저장. 산출물: public/hero/hand.webp (알파 포함)
 *
 * 손은 이미지 모델이 자주 틀리므로, 마음에 안 들면 재실행해 후보를 비교하세요.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/hero/hand.webp');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

const PROMPT = [
  'An elegant hand, back of the hand facing the camera,',
  'fingers gently spread in a graceful presenting gesture.',
  'Natural short clean fingernails, no nail art, no polish.',
  'Soft even studio light, minimal soft shadow.',
  'Isolated on a solid vivid chroma-key green screen background (bright green #00b140), evenly lit, no props, no gradient.',
  'Editorial hand-model photography, vertical composition, the whole hand and wrist fully in frame.',
  'Photorealistic, high detail, no jewelry, no text, no watermark.',
].join(' ');

/**
 * 크로마 그린 키아웃 — "그린 정도(g - max(r,b))"로 소프트 알파를 만들어 가장자리 앤티앨리어싱.
 * 그린 스필 제거 + 투명 픽셀 RGB를 0으로(트림이 손 영역만 남기도록).
 */
function keyOutGreen(raw: Buffer, w: number, h: number, channels: number): Buffer {
  const HI = 45, LO = 12; // 그린정도 ≥HI 완전투명, ≤LO 완전불투명, 사이는 램프
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * channels;
    let r = raw[p], g = raw[p + 1], b = raw[p + 2];
    const gm = g - Math.max(r, b); // 그린 정도
    let a: number;
    if (gm >= HI) a = 0;
    else if (gm <= LO) a = 255;
    else a = Math.round((255 * (HI - gm)) / (HI - LO));
    // 그린 스필 제거
    const maxRB = Math.max(r, b);
    if (g > maxRB) g = maxRB;
    if (a === 0) { r = 0; g = 0; b = 0; } // 투명 영역 색 통일 → 트림 정상 동작
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a;
  }
  return out;
}

async function run() {
  mkdirSync(dirname(OUT), { recursive: true });
  const base = process.env.SEEDREAM_BASE_URL ?? 'https://ark.ap-southeast.bytepluses.com/api/v3';
  const model = process.env.SEEDREAM_MODEL ?? 'seedream-4-0';
  console.log('손 이미지 생성 중… (흰 배경, 모델:', model, ')');
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.SEEDREAM_API_KEY ?? ''}` },
    body: JSON.stringify({ model, prompt: PROMPT, size: '1728x2304', response_format: 'b64_json', watermark: false }),
  });
  if (!res.ok) throw new Error(`Ark ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('이미지가 반환되지 않음');

  const src = sharp(Buffer.from(b64, 'base64'));
  const { width, height } = await src.metadata();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  console.log('누끼 처리 중(크로마 그린)…', info.width + 'x' + info.height);
  const rgba = keyOutGreen(data, info.width, info.height, info.channels);

  await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim() // 투명 여백 제거 → 손 타이트 크롭
    .resize({ width: 1000, withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(OUT);
  console.log('생성 완료(투명 배경):', OUT, `(원본 ${width}x${height})`);
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
