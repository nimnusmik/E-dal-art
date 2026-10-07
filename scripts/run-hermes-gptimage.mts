/**
 * 일회성: 데스크탑 hermes 영감 사진 3장 → GPT 이미지 모델로 네일 세트 1장 생성.
 *
 *   npx tsx scripts/run-hermes-gptimage.mts
 *
 * 산출물: 같은 폴더(~/Desktop/untitled folder)에 hermes-result-<타임스탬프>.png
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = '/Users/sunminkim/Desktop/untitled folder';

// ── .env.local 수동 로드 (tsx는 자동 로드하지 않음) ──────────────
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (!m || m[1] in process.env) continue;
  // 인라인 주석(` # …`) 제거 후 양끝 따옴표 벗기기
  let v = m[2].replace(/\s+#.*$/, '').trim();
  v = v.replace(/^(['"])(.*)\1$/, '$2');
  process.env[m[1]] = v;
}
process.env.IMAGE_PROVIDER = 'gptimage'; // 공급자 강제

const { generateImage, imageProvider } = await import('../lib/provider');
const { analyzeToBrief, buildBriefPrompt } = await import('../lib/brief');

// 인자로 파일명 지정 가능 (기본: hermes 3종)
const files = process.argv.slice(2);
const inspiration = (files.length > 0 ? files : ['hermes.png', 'hermes2.png', 'hermes3.jpeg']).map((f) => ({
  data: readFileSync(resolve(SRC_DIR, f)).toString('base64'),
  mimeType: f.endsWith('.png') ? 'image/png' : 'image/jpeg',
}));

console.log(`공급자: ${imageProvider()} / 모델: ${process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1.5(기본)'}`);

console.log('1단계: 영감 사진 분석 중…');
// Gemini 503 스파이크 대비 — analyzeToBrief 자체 재시도(1회) 위에 외부 백오프 3회
let brief = null;
for (let i = 0; i < 3 && !brief; i++) {
  if (i > 0) {
    console.log(`  503 스파이크 — ${i * 10}초 대기 후 재시도…`);
    await new Promise((r) => setTimeout(r, i * 10_000));
  }
  brief = await analyzeToBrief(inspiration);
}
if (!brief) throw new Error('분석 실패 — GEMINI_API_KEY/쿼터 확인');
console.log(`브리프: ${brief.moodLine} / 키워드: ${brief.keywords.join(', ')}`);

// 같은 브리프·프롬프트로 quality만 바꿔 A/B 비교 (QUALITIES=medium,high 처럼 지정)
const prompt = buildBriefPrompt(brief);
const stamp = Date.now();
for (const q of (process.env.QUALITIES ?? 'auto').split(',')) {
  process.env.OPENAI_IMAGE_QUALITY = q === 'auto' ? '' : q;
  console.log(`2단계: 이미지 생성 중… (quality=${q})`);
  const outcome = await generateImage(inspiration, prompt);
  if (!outcome.image) throw new Error(`생성 실패 (safetyBlocked=${outcome.safetyBlocked})`);
  const ext = outcome.image.mimeType.includes('png') ? 'png' : 'jpg';
  const out = resolve(SRC_DIR, `hermes-result-${stamp}-${q}.${ext}`);
  writeFileSync(out, Buffer.from(outcome.image.data, 'base64'));
  console.log(`저장 완료: ${out}`);
}
