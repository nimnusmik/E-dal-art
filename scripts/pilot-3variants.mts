/**
 * 큰 변주 3종 파일럿 — 히어로 드롭존 영감 3장 → 분석 → 플랜 3종 → 생성+검수(낙제 1회 재시도).
 * /api/variant와 같은 규칙을 라우트 없이 돌린다.
 *
 *   npx tsx scripts/pilot-3variants.mts          # 실호출 (분석 1 + 플랜 1 + 생성 3~6)
 *   npx tsx scripts/pilot-3variants.mts --mock
 *   npx tsx scripts/pilot-3variants.mts --run=run2   # 결과를 하위 폴더에 (이전 결과 보존)
 *
 * 산출물: ref/results/pilot-3variants/v1~v3.jpg + manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE_DIR = resolve(ROOT, 'ref/results/pilot-3variants');
const run = process.argv.find((a) => a.startsWith('--run='))?.split('=')[1];
const OUT_DIR = run ? resolve(BASE_DIR, run) : BASE_DIR;

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const mock = process.argv.includes('--mock');
if (mock) {
  process.env.GEMINI_MOCK = '1';
  process.env.SEEDREAM_MOCK = '1';
} else {
  delete process.env.GEMINI_MOCK;
  delete process.env.SEEDREAM_MOCK;
}

const { generateImage, imageProvider } = await import('../lib/provider');
const { analyzeToBrief, applyOptions, applyPlan, buildBriefPrompt, planVariants } = await import('../lib/brief');
const { judgeImage, verdictDetail } = await import('../lib/judge');

const INPUTS = ['tattoo', 'dreamy', 'fairycore'].map((n) => ({
  data: readFileSync(resolve(BASE_DIR, 'input', `${n}.jpg`)).toString('base64'),
  mimeType: 'image/jpeg',
}));

mkdirSync(OUT_DIR, { recursive: true });
console.log(`공급자: ${imageProvider()}${mock ? ' (MOCK)' : ''}`);

// Gemini 분석이 간헐적으로 실패한다(2026-09-22 여러 차례) — 시험 스크립트에서만 3회까지 재시도
let raw = null;
for (let attempt = 1; attempt <= 3 && !raw; attempt++) {
  raw = await analyzeToBrief(INPUTS);
  if (!raw) console.log(`분석 실패 ${attempt}/3`);
}
if (!raw) throw new Error('분석 실패');
// 참고 스타일(3D 젤리)은 긴 스틸레토에서 산다 — 앱에서는 손님 옵션이 이 자리를 채운다
const brief = applyOptions(raw, { shape: 'stiletto', length: 'long', partsIntensity: 'auto' });
const plans = await planVariants(brief);
console.log('플랜:', plans.map((p) => `${p.id} ${p.title} — ${p.note ?? ''}`).join('\n      '));

let images = 0;
const results = await Promise.all(
  plans.map(async (plan) => {
    const merged = applyPlan(brief, plan);
    const prompt = buildBriefPrompt(merged);
    let best: { data: string; mimeType: string } | null = null;
    let quality = null as ReturnType<typeof verdictDetail> | null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      const out = await generateImage(INPUTS, prompt);
      images++;
      if (!out.image) continue;
      const j = await judgeImage(out.image, merged);
      const q = j ? verdictDetail(j, merged) : null;
      if (!best || (q && (!quality || q.pass || q.score > quality.score))) {
        best = out.image;
        quality = q;
      }
      if (!q || q.pass) break; // 통과작·검수 실패는 재시도 없음 (라우트와 동일)
    }
    if (best) writeFileSync(resolve(OUT_DIR, `${plan.id}.jpg`), Buffer.from(best.data, 'base64'));
    console.log(`${plan.id} ${plan.title}: ${quality ? `${quality.pass ? 'PASS' : 'FAIL'} ${quality.score}/6 ${quality.issues.join(', ')}` : '검수 없음'}`);
    return { plan, prompt, quality };
  }),
);

writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify({ brief, results, images }, null, 2));
console.log(`생성 ${images}장 → ${OUT_DIR}`);
