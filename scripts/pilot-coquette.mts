/**
 * 트렌디 코케트 스타일(ref/trendy/STYLE_ANALYSIS.md v2) 파일럿.
 * 목적: 스타일 문법 프롬프트로 10세트를 생성해 4기준 루브릭 통과율을 측정.
 *
 *   npx tsx scripts/pilot-coquette.mts          # 실호출 (API 10회, 소액 과금)
 *   npx tsx scripts/pilot-coquette.mts --mock   # 드라이런
 *
 * 산출물: ref/results/pilot-coquette/set-01..10.jpg + manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'ref/results/pilot-coquette');

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

// ── 스타일 슬롯 (STYLE_ANALYSIS.md v2의 패턴 어휘·팔레트·포인트) ──
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
const POINTS = [
  'one nail with cursive black script lettering "Angel" placed diagonally',
  'one nail with a single small 3D acrylic rose',
  'one nail with 2-3 tiny silver ball studs on the boundary line',
  'one nail with one pearl near the cuticle',
  'one nail with a small star-shaped gem',
];
const INSPIRATIONS = ['IMG_6093.jpg', 'IMG_6099.jpg', 'IMG_6100.jpg', 'IMG_6102.jpg', 'IMG_6104.jpg'];

// ── v2 문법을 프롬프트로 직번역: 역할 배분 + 변주 연산자 + 하드 넘버 ──
function buildCoquettePrompt(pattern: string, palette: string, point: string): string {
  return `You are a top Korean nail artist presenting this month's design set.
Create ONE photorealistic top-down flat-lay photo of a press-on nail SET: exactly 10 individual almond nail tips arranged neatly in 2 rows of 5 on a plain light-grey background, evenly spaced, soft even studio lighting.

STYLE CONSTITUTION — follow every rule:
- Base of EVERY tip: sheer milky nude with a glass-like high-gloss gel finish. At least 60% of each tip stays bare nude negative space.
- Structure: deep French tips — the design lives ONLY inside the tip area (bottom 30-45% of the nail). Patterns must never spread over the whole nail.
- Theme pattern for this set: ${pattern}, in ${palette}. Low-saturation sugary pastels only; never neon or vivid colors.
- Role grammar for the 10 tips: 2 anchor tips (${point}), 5-6 rhythm tips (the theme pattern varied per tip: invert figure/ground colors, change dot/line scale, change density, or swap the french boundary between smile-line / diagonal / straight), and 2-3 rest tips (nearly bare nude, at most one tiny silver stud).
- Charm budget across the whole set: at most 2 small charms total plus a few tiny silver ball studs. Charms sit low and flat with visible gel encapsulation.
- Every element hand-paintable by a human artist with gel: slight hand-made micro-variations, natural gel edge highlights, not computer-perfect.
- Mood: kawaii coquette Y2K, like a Japanese lolita girl's sewing box (lace trim, buttons, gingham fabric, pearls) — but expressed ONLY through the patterns and colors described above, never draw literal sewing objects.
- Never include: marble texture, chunky glitter, ombre/gradient french, cartoon characters, food motifs (donut, candy, cake), ribbon bows, dangling charms, stiletto shape, matte finish, neon colors, full-nail patterns without french structure.
- The 10 tips are the only subject: no hands, no text overlays, no packaging, no UI elements, no page indicators.`;
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
  for (let i = 0; i < 10; i++) {
    const pattern = PATTERNS[i % PATTERNS.length];
    const palette = PALETTES[(i + Math.floor(i / PATTERNS.length)) % PALETTES.length];
    const point = POINTS[i % POINTS.length];
    const inspiration = INSPIRATIONS[i % INSPIRATIONS.length];
    const prompt = buildCoquettePrompt(pattern, palette, point);

    const id = String(i + 1).padStart(2, '0');
    process.stdout.write(`[${id}/10] ${pattern} / ${palette} ... `);
    try {
      const outcome = await generateImage(loadInspiration(inspiration), prompt);
      if (!outcome.image) {
        console.log(`실패 (safetyBlocked=${outcome.safetyBlocked})`);
        manifest.push({ id, pattern, palette, point, inspiration, ok: false, safetyBlocked: outcome.safetyBlocked });
        continue;
      }
      const out = resolve(OUT_DIR, `set-${id}.jpg`);
      writeFileSync(out, Buffer.from(outcome.image.data, 'base64'));
      console.log(`✓ set-${id}.jpg`);
      manifest.push({ id, pattern, palette, point, inspiration, ok: true });
    } catch (e) {
      console.log(`오류: ${(e as Error).message}`);
      manifest.push({ id, pattern, palette, point, inspiration, ok: false, error: (e as Error).message });
    }
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  const okCount = manifest.filter((m) => (m as { ok: boolean }).ok).length;
  console.log(`\n생성 완료: ${okCount}/10 — 산출물: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
