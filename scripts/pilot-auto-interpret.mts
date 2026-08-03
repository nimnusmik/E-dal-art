/**
 * 자동 해석 엔드투엔드 파일럿 — 영감 이미지 → [vision 분석: 구조 문법 브리프] → [생성].
 * 수동 브리프 파일럿(pilot-interpret)과 같은 3장으로 돌려 충실도를 직접 비교한다.
 *
 *   npx tsx scripts/pilot-auto-interpret.mts            # 실호출 (분석 3회 + 생성 3회)
 *   npx tsx scripts/pilot-auto-interpret.mts --mock
 *   npx tsx scripts/pilot-auto-interpret.mts --only=03
 *
 * 산출물: ref/results/pilot-auto-interpret/set-XX.jpg + brief-XX.json + manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'ref/results/pilot-auto-interpret');

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

const { generateImage, imageProvider } = await import('../lib/provider');
const { analyzeToBrief, buildBriefPrompt } = await import('../lib/brief');

// 수동 브리프 파일럿과 동일한 3장 (비교 기준)
const IMAGES = ['IMG_5615.jpg', 'IMG_5616.jpg', 'Nails.jpeg'];

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
    process.stdout.write(`[${id}/${IMAGES.length}] ${image} 분석 ... `);

    const brief = await analyzeToBrief([load(image)]);
    if (!brief) {
      console.log('분석 실패');
      manifest.push({ id, image, ok: false, stage: 'analyze' });
      continue;
    }
    writeFileSync(resolve(OUT_DIR, `brief-${id}.json`), JSON.stringify(brief, null, 2));
    process.stdout.write(`✓ (${brief.shape}/${brief.length}, 파츠: ${brief.partsLine.slice(0, 40)}...) 생성 ... `);

    try {
      const outcome = await generateImage([load(image)], buildBriefPrompt(brief));
      if (!outcome.image) {
        console.log(`실패 (safetyBlocked=${outcome.safetyBlocked})`);
        manifest.push({ id, image, ok: false, stage: 'generate', safetyBlocked: outcome.safetyBlocked });
        continue;
      }
      writeFileSync(resolve(OUT_DIR, `set-${id}.jpg`), Buffer.from(outcome.image.data, 'base64'));
      console.log(`✓ set-${id}.jpg`);
      manifest.push({ id, image, ok: true, keywords: brief.keywords, difficulty: brief.difficulty });
    } catch (e) {
      console.log(`오류: ${(e as Error).message}`);
      manifest.push({ id, image, ok: false, stage: 'generate', error: (e as Error).message });
    }
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n완료 — 산출물: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
