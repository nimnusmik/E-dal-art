/**
 * 저장된 프롬프트 재생성 — 기준 회차(manifest.json)의 프롬프트를 그대로 또는 한 줄만 바꿔 다시 그린다.
 * "한 번에 하나만 바꾸기" 비교용. Gemini 호출 없음.
 *
 *   npx tsx scripts/regen-from-manifest.mts <run 폴더> <출력 이름> [--insert="한 줄"]
 *   (--insert는 "- Mood:" 줄 바로 앞에 넣는다)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
delete process.env.SEEDREAM_MOCK;
const [runDir, outName] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const insert = process.argv.find((a) => a.startsWith('--insert='))?.slice('--insert='.length);
if (!runDir || !outName) throw new Error('사용법: regen-from-manifest.mts <run 폴더> <출력 이름> [--insert=...]');

const { generateImage } = await import('../lib/provider');
const manifest = JSON.parse(readFileSync(resolve(runDir, 'manifest.json'), 'utf8'));
const outDir = resolve(dirname(resolve(runDir)), outName);
mkdirSync(outDir, { recursive: true });
const INPUTS = ['tattoo', 'dreamy', 'fairycore'].map((n) => ({
  data: readFileSync(resolve(ROOT, 'ref/results/pilot-3variants/input', `${n}.jpg`)).toString('base64'),
  mimeType: 'image/jpeg',
}));

await Promise.all(
  manifest.results.map(async (r: { plan: { id: string; title: string }; prompt: string }) => {
    const prompt = insert ? r.prompt.replace('\n- Mood:', `\n${insert}\n- Mood:`) : r.prompt;
    if (insert && prompt === r.prompt) throw new Error(`${r.plan.id}: 삽입 위치(- Mood:)를 못 찾음`);
    writeFileSync(resolve(outDir, `${r.plan.id}.prompt.txt`), prompt);
    const out = await generateImage(INPUTS, prompt);
    if (!out.image) return console.log(`${r.plan.id}: 실패`);
    writeFileSync(resolve(outDir, `${r.plan.id}.jpg`), Buffer.from(out.image.data, 'base64'));
    console.log(`${r.plan.id} ${r.plan.title}: 저장`);
  }),
);
