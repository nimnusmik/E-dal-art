/**
 * 수동 설계도 → 생성. 분석·설계·검수를 사람이(또는 대화 중인 Claude가) 맡고 그림만 Seedream이 그린다.
 * Gemini를 한 번도 부르지 않는다 (무료 한도 20회/일에 막혀도 돌아감).
 *
 *   npx tsx scripts/generate-from-plan.mts <plan.json> [--only=v2] [--mock]
 *
 * plan.json: { common: 브리프 공통 필드, variants: [{ id, title, shape, styleId, patternLines, partsLine, overrides? }] }
 * overrides: 스타일의 baseLine/structureLine/textureLine을 이 설계에서만 덮어쓸 때 (무드에 맞게)
 * rawPrompt: 세트 형식이 아닌 결과물(예: 이달의아트 판)을 시험할 때 — 프롬프트를 그대로 쓴다
 * 산출물: plan.json 옆 <plan 이름>/ 폴더에 <id>.jpg + <id>.prompt.txt (설계도마다 폴더가 달라 덮어쓰지 않는다)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
const args = process.argv.slice(2);
const mock = args.includes('--mock');
if (mock) process.env.SEEDREAM_MOCK = '1';
else delete process.env.SEEDREAM_MOCK;
const only = args.find((a) => a.startsWith('--only='))?.split('=')[1];
const planPath = args.find((a) => !a.startsWith('--'));
if (!planPath) throw new Error('사용법: generate-from-plan.mts <plan.json>');

const { buildBriefPrompt } = await import('../lib/brief');
const { generateImage } = await import('../lib/provider');
const { STYLES } = await import('../config/styles');
import type { NailBrief } from '../lib/brief';
import type { StyleId } from '../config/styles';

const plan = JSON.parse(readFileSync(resolve(planPath), 'utf8'));
const outDir = resolve(dirname(resolve(planPath)), basename(planPath, '.json'));
mkdirSync(outDir, { recursive: true });
// 영감 사진은 무드 참고로만 첨부 — 무엇을 그릴지는 팁별 설계가 정한다
const INPUTS = ['tattoo', 'dreamy', 'fairycore'].map((n) => ({
  data: readFileSync(resolve(ROOT, 'ref/results/pilot-3variants/input', `${n}.jpg`)).toString('base64'),
  mimeType: 'image/jpeg',
}));

await Promise.all(
  plan.variants
    .filter((v: { id: string }) => !only || v.id === only)
    .map(async (v: { id: string; title: string; shape: NailBrief['shape']; styleId: StyleId; patternLines: string[]; partsLine: string; overrides?: Partial<NailBrief>; rawPrompt?: string }) => {
      const style = STYLES[v.styleId] ?? STYLES['glass-jelly'];
      const brief: NailBrief = {
        ...plan.common,
        shape: v.shape,
        baseLine: style.baseLine,
        structureLine: style.structureLine,
        textureLine: style.textureLine,
        styleBlock: style.styleBlock,
        patternLines: v.patternLines,
        partsLine: v.partsLine,
        ...v.overrides,
      };
      const prompt = v.rawPrompt ?? buildBriefPrompt(brief);
      writeFileSync(resolve(outDir, `${v.id}.prompt.txt`), prompt);
      const out = await generateImage(INPUTS, prompt);
      if (!out.image) return console.log(`${v.id} ${v.title}: 실패 (${out.safetyBlocked ? '안전 차단' : '빈 응답'})`);
      writeFileSync(resolve(outDir, `${v.id}.jpg`), Buffer.from(out.image.data, 'base64'));
      console.log(`${v.id} ${v.title}: 저장`);
    }),
);
console.log(`완료 → ${basename(outDir)}/`);
