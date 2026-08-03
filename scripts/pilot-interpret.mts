/**
 * 이미지 해석 충실도 파일럿 — "영감 이미지마다 그 특징을 반영한 세트가 나오는가"
 *
 * 성격이 다른 레퍼런스 3장을 구조 문법(팔레트/패턴/구조/파츠/레터링)으로 해석한
 * 브리프를 각각 작성 → 브리프대로 1세트씩 생성 → 원본 대비 충실도 평가.
 * (브리프는 수동 작성 = 분석 단계의 상한선 검증. 자동화는 lib/analyze.ts 몫)
 *
 *   npx tsx scripts/pilot-interpret.mts          # 실호출 (API 3회)
 *   npx tsx scripts/pilot-interpret.mts --mock
 *
 * 산출물: ref/results/pilot-interpret/set-01..03.jpg + manifest.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'ref/results/pilot-interpret');

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

// 이미지별 해석 브리프 — 구조까지 원본에서 파생 (고정 스타일 헌법이 아님)
const BRIEFS = [
  {
    id: '01-animal-french',
    inspiration: 'IMG_5615.jpg',
    brief: `- Base of every tip: sheer milky nude, glass-gloss gel; the design occupies only the deep French tip area (bottom third), nude zone above stays empty.
- Palette: baby blue + deep chocolate brown on milky nude — exactly two accent colors.
- Theme: animal-print French tips, each tip a different print variation — zebra stripes in brown on baby blue, crocodile scales in brown, baby-blue zebra on brown, one tip with white micro-dots on deep brown, and one or two tips with a plain 3D-ridged wavy baby-blue tip (subtle sculpted gel waves).
- Shape: medium-long square tips.
- No metal, no gems, no pearls, no lettering anywhere — painted gel and subtle sculpted texture only.`,
  },
  {
    id: '02-citrus-picnic',
    inspiration: 'IMG_5616.jpg',
    brief: `- Shape: SHORT round natural nails-length tips.
- This set mixes full-color tips and art tips like a summer picnic: two tips in solid tangerine orange with tiny white micro polka dots, two tips in soft white with a pale sage-green gingham check, one tip in white with small hand-painted oranges (round tangerine fruits with green leaves), and one tip in tangerine with a single white hibiscus flower silhouette.
- Palette: warm tangerine orange + soft white + pale sage green. Fresh, sunny, low-gloss cream vibe but glossy gel finish.
- No metal, no gems, no pearls, no lettering — hand-painted gel only.`,
  },
  {
    id: '03-celestial-gold',
    inspiration: 'Nails.jpeg',
    brief: `- Base of every tip: sheer milky white with soft white marble veils and a faint gold shimmer wash — dreamy, like sunlight on water. Almond shape.
- Most tips stay nearly bare with this sheer marble; two tips carry a fine gold glitter dust fade near the tip end.
- PARTS RULE: exactly two tips each carry ONE small flat gold metal STUD lying flush on the nail surface — one stud shaped as a crescent moon, one stud shaped as an eight-point star — placed at the center and sealed under gel, like embossed metal stickers. Every other tip has no metal and no gems.
- Palette: milky white + champagne gold only. Elegant, minimal, bridal.
- No lettering anywhere.`,
  },
];

/**
 * 파츠 물리 법칙 — 모든 생성 프롬프트에 공통 첨부.
 * (2026-08-03 발견: "gold celestial charm"만 쓰면 목걸이 펜던트처럼 매달린 참이 렌더링됨.
 *  참은 반드시 "표면에 납작하게 붙어 젤로 봉인된" 형태로 명시해야 시술 가능한 물리가 나온다.)
 */
// 주의: "charm"이라는 단어 자체가 펜던트 고리를 부른다 — 파츠는 stud/inlay로 부를 것.
const PARTS_PHYSICS = `- METAL PART PHYSICS: every metal part is a FLAT embossed metal stud lying flush ON the nail surface, sealed under a layer of clear gel — glued down like a sticker with slight thickness. Each stud is a SOLID CAST shape with a clean closed outline, exactly the motif silhouette and nothing more (a crescent is just a crescent, a star is just a star). The stud stays fully inside the nail's outline.`;

function buildPrompt(brief: string): string {
  return `You are a top Korean nail artist presenting a design set inspired by the attached reference photo.
Create ONE photorealistic top-down flat-lay photo of a press-on nail tip sample board: individual nail tips laid out in neat rows on a plain light-grey background, soft even studio lighting.

DESIGN BRIEF — follow every line exactly:
${brief}
${PARTS_PHYSICS}
- Every element is hand-paintable by a human artist with gel: slight hand-made micro-variations, natural gel edge highlights, clean crisp edges.
- The tips are the only subject: plain background, clean composition, no text overlays, nothing else in frame.`;
}

function loadInspiration(file: string): { data: string; mimeType: string }[] {
  return [
    {
      data: readFileSync(resolve(ROOT, 'ref', file)).toString('base64'),
      mimeType: 'image/jpeg',
    },
  ];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`공급자: ${imageProvider()}${args.has('--mock') ? ' (MOCK)' : ''}`);

  // --only=03 처럼 특정 세트만 재생성
  const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];

  const manifest: object[] = [];
  for (let i = 0; i < BRIEFS.length; i++) {
    const b = BRIEFS[i];
    const id = String(i + 1).padStart(2, '0');
    if (only && id !== only) continue;
    process.stdout.write(`[${id}/${BRIEFS.length}] ${b.id} ... `);
    try {
      const outcome = await generateImage(loadInspiration(b.inspiration), buildPrompt(b.brief));
      if (!outcome.image) {
        console.log(`실패 (safetyBlocked=${outcome.safetyBlocked})`);
        manifest.push({ id: b.id, inspiration: b.inspiration, ok: false, safetyBlocked: outcome.safetyBlocked });
        continue;
      }
      writeFileSync(resolve(OUT_DIR, `set-${id}.jpg`), Buffer.from(outcome.image.data, 'base64'));
      console.log(`✓ set-${id}.jpg`);
      manifest.push({ id: b.id, inspiration: b.inspiration, ok: true });
    } catch (e) {
      console.log(`오류: ${(e as Error).message}`);
      manifest.push({ id: b.id, inspiration: b.inspiration, ok: false, error: (e as Error).message });
    }
  }

  writeFileSync(resolve(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`\n완료 — 산출물: ${OUT_DIR}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
