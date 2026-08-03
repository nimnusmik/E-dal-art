/**
 * 최종 파이프라인 파일럿 — 분석(brief) → 적응형 생성(2장+예비1) → 검수(judge) → 통과작 선택.
 * "이미지만 넣으면 알잘딱깔센"의 완성형을 엔드투엔드로 검증한다.
 *
 *   npx tsx scripts/pilot-judge.mts            # 실호출 (이미지당: 분석1 + 생성2~3 + 검수2~3)
 *   npx tsx scripts/pilot-judge.mts --mock
 *   npx tsx scripts/pilot-judge.mts --only=02
 *
 * 산출물: ref/results/pilot-judge/{best,attempt}-XX*.jpg + judge-XX.json + manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'ref/results/pilot-judge');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const args = new Set(process.argv.slice(2));
if (!args.has('--mock')) {
  delete process.env.GEMINI_MOCK;
  delete process.env.SEEDREAM_MOCK;
} else {
  process.env.GEMINI_MOCK = '1';
  process.env.SEEDREAM_MOCK = '1';
}

const { imageProvider } = await import('../lib/provider');
const { analyzeToBrief } = await import('../lib/brief');
const { generateJudged } = await import('../lib/judge');

// 파츠 있는 케이스(개수 검수)와 없는 케이스, 코케트 정수 케이스를 섞음
const IMAGES = ['trendy/IMG_6099.jpg', 'Nails.jpeg', 'IMG_5616.jpg'];

function load(file: string): { data: string; mimeType: string } {
  return { data: readFileSync(resolve(ROOT, 'ref', file)).toString('base64'), mimeType: 'image/jpeg' };
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`공급자: ${imageProvider()}${args.has('--mock') ? ' (MOCK)' : ''}`);
  const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

  const manifest: object[] = [];
  for (let i = 0; i < IMAGES.length; i++) {
    const id = String(i + 1).padStart(2, '0');
    if (only && id !== only) continue;
    const image = IMAGES[i];
    process.stdout.write(`[${id}] ${image} 분석 ... `);

    const brief = await analyzeToBrief([load(image)]);
    if (!brief) {
      console.log('분석 실패');
      manifest.push({ id, image, ok: false, stage: 'analyze' });
      continue;
    }
    process.stdout.write('✓ 생성+검수 ... ');

    const { best, attempts } = await generateJudged([load(image)], brief);
    attempts.forEach((a, n) => {
      writeFileSync(resolve(OUT_DIR, `attempt-${id}-${n + 1}.jpg`), Buffer.from(a.image.data, 'base64'));
    });
    if (best) writeFileSync(resolve(OUT_DIR, `best-${id}.jpg`), Buffer.from(best.image.data, 'base64'));
    writeFileSync(
      resolve(OUT_DIR, `judge-${id}.json`),
      JSON.stringify({ brief: { partsLine: brief.partsLine, letteringWord: brief.letteringWord }, attempts: attempts.map((a) => ({ pass: a.pass, score: a.score, judgement: a.judgement })) }, null, 2),
    );

    const passCount = attempts.filter((a) => a.pass).length;
    console.log(`시도 ${attempts.length}장, 통과 ${passCount}장 → best ${best ? (best.pass ? 'PASS' : `탈락작 중 최고점(${best.score}/6)`) : '없음'}`);
    manifest.push({ id, image, ok: !!best, attempts: attempts.length, passed: passCount });
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n완료 — 산출물: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
