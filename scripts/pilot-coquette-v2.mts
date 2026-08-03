/**
 * 트렌디 코케트 2차 파일럿 — 1차 실패 모드 수정판.
 * 변경점 (ref/results/pilot-coquette/REPORT.md + ref/PARTS_ANALYSIS.md 반영):
 *   1. 다의어 제거: "anchor tip" → "hero tip" (1차에서 7/10 세트에 닻⚓이 그려짐)
 *   2. 개수 강제 제거: "exactly 10, 2 rows of 5" → 느슨한 보드 서술 (모델은 개수를 못 셈)
 *   3. 부정문 → 긍정문: "no ombre" → "crisp solid boundary" 등
 *   4. 파츠 구조 문법 도입: S1 포인트/S2 스터드 드로잉/S4 경계선 앵커/S6 센터피스/파츠 없음
 *      — 파츠는 지정된 팁에만 언급, 나머지 팁에는 파츠 단어 자체가 등장하지 않음
 *
 *   npx tsx scripts/pilot-coquette-v2.mts          # 실호출 (API 10회)
 *   npx tsx scripts/pilot-coquette-v2.mts --mock   # 드라이런
 *
 * 산출물: ref/results/pilot-coquette-v2/set-01..10.jpg + manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// --out=이름 으로 산출 폴더, --count=N 으로 생성 수 조절 (기본 10)
const outArg = process.argv.find((a) => a.startsWith('--out='))?.split('=')[1] ?? 'pilot-coquette-v2';
const COUNT = Number(process.argv.find((a) => a.startsWith('--count='))?.split('=')[1] ?? 10);
const OUT_DIR = resolve(ROOT, 'ref/results', outArg);

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

// ── 슬롯: 1차와 동일한 패턴·팔레트 (통과율 비교를 위해 고정) ──
const PATTERNS = [
  'small polka dots',
  'thin 3-line stripes',
  'pastel gingham check',
  'hand-drawn loose swirl doodles',
  'polka dots with a delicate white lace-trim line along the french boundary',
];
const PALETTES = [
  'baby pink + baby blue on milky white',
  'butter yellow + sky blue',
  'milky white + black micro accents',
  'lilac + cream white',
  'baby pink + chocolate brown accents',
];

// ── 파츠 플랜: PARTS_ANALYSIS.md의 구조 문법 (S-코드) ──
// 파츠는 여기 지정된 팁에만 존재. 문장 자체가 "지정 외 팁 = 파츠 없음"을 못박는다.
const PART_PLANS = [
  {
    code: 'S1-pearl',
    line: 'Exactly one tip carries a single small pearl sitting right on its french boundary line, like a tiny brooch. Every other tip is painted gel only — bare of metal, gems, and pearls.',
  },
  {
    code: 'S2-stud-drawing',
    line: 'On just two tips, tiny silver microbeads are arranged in one precise cross outline each — beads forming the shape like pixels, nothing scattered. Every other tip is painted gel only, with no metal anywhere.',
  },
  {
    code: 'S6-rose',
    line: 'One hero tip carries a single small 3D acrylic rose at its center. Every other tip is painted gel only — no metal, no gems.',
  },
  {
    code: 'none',
    line: 'This set is purely hand-painted: every tip is gel paint only, with zero metal, zero gems, zero pearls, zero 3D charms.',
  },
  {
    code: 'S4-boundary-studs',
    line: 'On three tips, one tiny silver bead sits exactly ON the french boundary line like a belt buckle stud — one bead per tip. Every other tip is painted gel only with no metal.',
  },
];
const INSPIRATIONS = ['IMG_6093.jpg', 'IMG_6099.jpg', 'IMG_6100.jpg', 'IMG_6102.jpg', 'IMG_6104.jpg'];

// ── 레터링 슬롯: 세트 무드에 맞는 짧은 단어 (하드코딩 "Angel" 반복 문제 수정) ──
// 짧고 흔한 단어일수록 필기체 렌더링이 안정적. null = 레터링 없는 세트.
const LETTERINGS: (string | null)[] = ['Sugar', 'Honey', 'Cherie', null, 'Bonbon'];

function buildPromptV2(pattern: string, palette: string, partLine: string, lettering: string | null): string {
  const letteringLine = lettering
    ? `exactly one tip carries a single short cursive black script word "${lettering}" — written once, on one tip only`
    : 'no tip carries any lettering or text';
  return `You are a top Korean nail artist presenting this month's design set.
Create ONE photorealistic top-down flat-lay photo of a press-on nail tip sample board: individual almond nail tips laid out in neat rows on a plain light-grey background, soft even studio lighting.

STYLE CONSTITUTION — follow every rule:
- Base of EVERY tip: sheer milky nude with a glass-like high-gloss gel finish. Most of each tip stays bare nude — the design occupies only the tip end.
- Structure: deep French tips with a crisp, clean solid-color boundary edge (smile-line, diagonal, or straight). The painted design lives ONLY inside the tip area (bottom third of the nail). The nude zone above the boundary stays completely empty and glossy.
- Theme pattern for this set: ${pattern}, in ${palette}. Colors are soft, low-saturation sugary pastels with plenty of white; the deepest tone appears only in small doses (dots, thin lines).
- Vary the tips like a human artist: some tips carry the theme pattern with the figure/ground colors swapped, some change the dot/line scale or density, some swap the boundary shape; ${letteringLine}. A couple of tips stay almost bare — just the nude base with a plain pastel french edge.
- PARTS RULE: ${partLine}
- CHARM PHYSICS: any charm or metal part is a FLAT, low-profile piece lying flush ON the nail surface, sealed under clear gel — no loops, no chains, nothing hanging or dangling, nothing extending past the nail edge.
- Every element is hand-paintable by a human artist with gel: slight hand-made micro-variations, natural gel edge highlights, clean crisp edges.
- Mood: kawaii coquette Y2K — sweet, airy, wearable, editorial.
- The tips are the only subject: plain background, clean composition, nothing else in frame.`;
}

function loadInspiration(file: string): { data: string; mimeType: string }[] {
  return [
    {
      data: readFileSync(resolve(ROOT, 'ref/trendy', file)).toString('base64'),
      mimeType: 'image/jpeg',
    },
  ];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`공급자: ${imageProvider()}${args.has('--mock') ? ' (MOCK)' : ''}`);

  const manifest: object[] = [];
  for (let i = 0; i < COUNT; i++) {
    const pattern = PATTERNS[i % PATTERNS.length];
    const palette = PALETTES[(i + Math.floor(i / PATTERNS.length)) % PALETTES.length];
    const plan = PART_PLANS[i % PART_PLANS.length];
    const inspiration = INSPIRATIONS[i % INSPIRATIONS.length];
    const lettering = LETTERINGS[i % LETTERINGS.length];
    const prompt = buildPromptV2(pattern, palette, plan.line, lettering);

    const id = String(i + 1).padStart(2, '0');
    process.stdout.write(`[${id}/${COUNT}] ${pattern} / ${plan.code} ... `);
    try {
      const outcome = await generateImage(loadInspiration(inspiration), prompt);
      if (!outcome.image) {
        console.log(`실패 (safetyBlocked=${outcome.safetyBlocked})`);
        manifest.push({ id, pattern, palette, parts: plan.code, lettering, inspiration, ok: false, safetyBlocked: outcome.safetyBlocked });
        continue;
      }
      writeFileSync(resolve(OUT_DIR, `set-${id}.jpg`), Buffer.from(outcome.image.data, 'base64'));
      console.log(`✓ set-${id}.jpg`);
      manifest.push({ id, pattern, palette, parts: plan.code, lettering, inspiration, ok: true });
    } catch (e) {
      console.log(`오류: ${(e as Error).message}`);
      manifest.push({ id, pattern, palette, parts: plan.code, lettering, inspiration, ok: false, error: (e as Error).message });
    }
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const okCount = manifest.filter((m) => (m as { ok: boolean }).ok).length;
  console.log(`\n생성 완료: ${okCount}/${COUNT} — 산출물: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
