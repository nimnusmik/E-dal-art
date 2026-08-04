/**
 * 히어로 네일아트 후보 6차 라운드 — 1단계: "재질 스와치 텍스처 생성" 파이프라인
 * 자체는 4~5차와 동일(손톱 모양과 무관하게 대형 캔버스에 텍스트+참조이미지로
 * 생성 → 코드로 결정론적 매핑). 6차가 바꾸는 것은 딱 하나 — **세트 조화**다.
 *
 * 사용자 기각 사유(2): "은장 라인워크가 손톱마다 제멋대로 방향이라 낙서/
 * 패치워크처럼 보인다." 5차까지는 base/accent 패널 프롬프트가 "우아하게 휘어지는
 * 세선"이라고만 지시해 모델이 매번 다른 방향으로 선을 그렸고, 손톱마다 텍스처의
 * 다른 영역을 크롭하다 보니(SAMPLE_SPOTS) 다섯 손톱이 서로 무관한 방향으로
 * 읽혔다.
 *
 * 6차 조치 — 합성 전에 세트의 "작곡 규칙"을 먼저 정한다:
 *   1. 모티프는 후보당 단 하나만 쓴다(여러 아이콘을 섞지 않음) — 후보1은
 *      tattoo.webp의 날개+하트 아이콘 하나, 후보2는 dreamy.webp의 별똥별 궤적
 *      하나. wings.webp/dreamy.webp의 나머지 요소(달·별자리 등)는 이번엔
 *      쓰지 않는다 — 모티프가 여럿이면 그 자체로 패치워크처럼 읽히기 때문.
 *   2. 텍스처 프롬프트에 "화면 전체에 걸쳐 모든 선이 동일한 대각선 방향
 *      (좌하→우상)으로 흐른다"를 명시해, 텍스처의 어느 영역을 크롭하든 방향이
 *      일관되게 한다(레퍼런스: wings.webp 좌우 날개가 같은 깃털 결 방향으로
 *      대칭 흐르는 것).
 *   3. accent(중지·약지)는 같은 방향의 라인 위에 모티프(하트/별똥별)를 한 번
 *      더 얹은 "포컬 포인트"로, base(엄지·검지·소지)는 같은 방향의 단순화된
 *      메아리(라인 1~2개, 모티프 없음)로 — "장식 밀도가 다른 5개"가 아니라
 *      "하나의 디자인이 두 세기로 반복되는 세트"로 읽히게 한다.
 *
 *   npx tsx scripts/generate-nail-texture-v6.mts        (2개 후보 전부)
 *   npx tsx scripts/generate-nail-texture-v6.mts v6-1   (특정 후보만)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from '../lib/provider.ts';
import type { ImagePayload } from '../lib/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = '/tmp/nailwork/v6-glaze-textures';

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

const INSPO_FILES = ['tattoo.webp', 'dreamy.webp', 'fairycore.webp', 'wings.webp'];
function loadInspoImages(): ImagePayload[] {
  return INSPO_FILES.map((f) => ({
    data: readFileSync(resolve(ROOT, 'public/hero/insp', f)).toString('base64'),
    mimeType: 'image/webp',
  }));
}

const SURFACE_FRAME =
  'Macro flat-lay studio photograph of a nail polish design SWATCH CARD/SAMPLE PANEL — a flat rectangular material sample used by a Korean nail salon to show a manicure surface finish to clients, shot top-down and dead flat under soft even studio light. ' +
  'The design must fill the ENTIRE frame edge-to-edge as one continuous seamless surface — absolutely NOT a nail shape, NOT a finger, NOT a hand, NOT an isolated tip cutout, NOT on a white background: it is a full-bleed rectangular material swatch, like a fabric or metal-foil sample chip. ' +
  'High resolution, tack-sharp macro detail so every fine foil line, pearl grain, and gradient transition is crisp. Absolutely NO printed text, caption, title, label, logo, or watermark anywhere in the image — the image must contain zero letters and zero words, only the physical material surface. No ruler, no hand holding it.';

const HUMAN_ARTIST_LINES = [
  'Realism is the top priority: this must look like a real photographed gel-polish + foil + pearl-powder surface, buildable by hand by a skilled Korean nail artist — not a 3D render, not flat vector art, not a seamless tileable pattern-generator texture.',
  'Avoid the AI look entirely: no plastic waxy sheen, no oversaturated flat poster colors, no melted/blurred edges, no mannequin look.',
  'Keep believable hand-made character: natural gel thickness, real light falloff, tiny organic irregularity in linework — not computer-perfect symmetry.',
].join(' ');

/**
 * accent 패널 전용 초강력 단일-모티프 강제 문구. 1차 생성에서 accent 두
 * 패널 모두 지시를 어기고 사과(밴 대상 과일 모티프), 여러 겹 스크롤/플로럴
 * 테두리 장식, 하트 여러 개, 별 여러 개를 추가로 그려 반환했다 — "딱 하나의
 * 모티프"라는 지시만으로는 부족해서, 구체적으로 "그 외에는 아무것도 없는
 * 평평한 단색 배경"이라고 못박고, 재발한 구체적 위반 사례(사과·스크롤 테두리)를
 * 이름으로 금지한다.
 */
const ACCENT_SINGLE_MOTIF_LOCK =
  'STRICT single-motif rule (this is more important than decorative richness): the ONLY thing on this panel besides the flat deep glossy color is the ONE motif named below. ' +
  'Absolutely NO apples or any fruit shape anywhere (this rule was violated in a previous attempt — do not repeat it). ' +
  'Absolutely NO scrollwork borders, NO corner flourishes, NO floral sprigs, NO vine swirls, NO extra hearts beyond the one named motif, NO extra stars beyond the one named motif, NO moon, NO second small icon anywhere in any corner. ' +
  'The rest of the panel must be perfectly plain, empty, flat deep glossy color with only subtle light falloff — like a plain lacquered chip with exactly one small foil design near the middle and nothing else touching the edges or corners.';

/**
 * 실측 발견(6차, v6-2-base 1차 재생성): DERIVATION_GUARDRAILS에 이미 "글자
 * 금지"가 있었는데도 base 패널 하나가 화면 중앙 우측에 tattoo.webp의 "墮落
 * 天使" 원형 배지를 그대로 베껴 반환했다(다른 3개 패널은 깨끗했음) — 금지
 * 문구를 매 프롬프트 맨 앞에 다시 한번, 더 짧고 강하게 반복해 재발을 막는다.
 */
const ZERO_TEXT_REPEAT =
  'Repeat, most important rule: ZERO text. Do not render any of the tattoo-flash reference\'s circular text badges or Chinese/Korean caption bubbles anywhere on this panel, even partially, even small, even blurred in a corner. If you are tempted to add a small circular badge with characters in it — do not.';

const DERIVATION_GUARDRAILS =
  'Four attached reference photos are this month\'s mood board (a fine-line tattoo-flash sheet, a dreamy pastel starscape, a whimsical fairycore sketch collage, and a pair of soft angel wings on a pink gradient) — pull ONLY their line-art vocabulary (delicate curving hairline strokes, wing feather flow, star/moon/heart/scroll shapes) and their color family (blush pink, lilac, powder blue/mint) into this design. ' +
  'Do NOT copy their pale washed-out brightness or low contrast — this design must still hit full glazed-glossy nail-salon saturation and shine, richer and more dimensional than the flat reference photos. ' +
  'Absolutely FORBIDDEN, even though they appear in the tattoo-flash reference photo: any Chinese characters, Korean characters (Hangul), Latin letters, words, or lettering of any kind anywhere in the image; any clover-leaf shape; any apple or fruit shape; any tiara, crown, or dangling jewelry charm shape. Reproduce none of the tattoo sheet\'s literal icons except the single wing-and-heart silhouette explicitly named below — only its fine hairline linework technique otherwise.';

/**
 * 세트 조화 규칙(공통) — 두 후보 모두에 적용. 모든 선이 화면 전체에서 동일한
 * 대각선 방향으로 흐르게 강제해, 텍스처의 어느 영역을 크롭해도(SAMPLE_SPOTS)
 * 방향이 일관되게 한다.
 */
const FLOW_DIRECTIVE =
  'CRITICAL composition rule for a cohesive matching nail-art SET: every single linework stroke across the ENTIRE panel must flow in the SAME diagonal direction, sweeping from lower-left to upper-right at a consistent ~50-60 degree angle — like wind-swept feathers or hair all combed the same way, never radiating outward, never crossing at odd angles, never a different direction in different corners of the panel. If you generate more than one line, they must all be near-parallel to each other, just offset in position, like a single gust of wind rendered several times. This is the single most important rule: any region cropped out of this panel must show lines flowing that one consistent direction.';

interface TexturePanel {
  slot: 'base' | 'accent';
  prompt: string;
}
interface Candidate {
  id: string;
  label: string;
  compositionRule: string;
  panels: TexturePanel[];
}

const CANDIDATES: Candidate[] = [
  {
    id: 'v6-1',
    label: '천사날개 글레이즈 — 오로라 펄 베이스(엄지·검지·소지에 단순화된 깃털 라인 메아리) + 딥 로즈와인 액센트(중지·약지, 날개-하트 포컬 모티프)',
    compositionRule:
      '단일 모티프(날개로 감싼 하트, tattoo.webp의 그 아이콘 하나)만 사용. 다섯 손톱 전부 같은 대각선(좌하→우상) 방향의 깃털 세선이 흐르고, 중지·약지만 그 위에 하트 포컬 포인트가 더해진다 — "장식 많은 손톱들"이 아니라 "하나의 디자인이 두 세기로 반복되는 세트".',
    panels: [
      {
        slot: 'base',
        prompt:
          `${ZERO_TEXT_REPEAT} ${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ${FLOW_DIRECTIVE} ` +
          "This month's signature design: a glazed aurora pearl-chrome glaze blending soft blush pink and lilac like the wing-gradient photo, with a glassy glossy top layer and real oil-on-water iridescent sheen. " +
          'Layered on top: just 2-3 hairline-thin (about 1mm true scale) mirror-bright silver foil feather-line strokes, all following the one consistent diagonal flow direction described above (like a single wing feather brushed across the surface) — simple and sparse, NOT a full wing shape, NOT a heart, just the bare feather-line texture. A few tiny flat micro pearls scattered along the lines like stardust. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${ZERO_TEXT_REPEAT} ${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ${FLOW_DIRECTIVE} ${ACCENT_SINGLE_MOTIF_LOCK} ` +
          "This month's signature design: a deep, richly saturated rose-wine mirror-chrome gel lacquer (a deepened, jewel-tone version of the pink gradient behind the angel wings) — one continuous deep color across the whole panel, high-shine mirror-glossy top coat, soft directional highlight sheen, not flat, not faceted, not split into color blocks. " +
          'The one motif: a small, delicate wing-wrapped-heart silhouette line-art icon (inspired by the tattoo-flash reference\'s wing+heart icon, shape only, no letters) in hairline-thin mirror-bright silver foil, near the center, oriented so its main sweep follows the same lower-left-to-upper-right diagonal flow as the base panel\'s feather lines, so both panels visually rhyme as one cohesive set. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
  {
    id: 'v6-2',
    label: '별똥별 글레이즈 — 오로라 펄 베이스(엄지·검지·소지에 단순화된 유성 라인 메아리) + 딥 미드나잇 라벤더 액센트(중지·약지, 별똥별 포컬 모티프)',
    compositionRule:
      '단일 모티프(별똥별 궤적 하나, dreamy.webp의 그 요소 하나만 — 달·별자리·꽃병은 쓰지 않음)만 사용. 다섯 손톱 전부 같은 대각선(좌하→우상) 방향의 유성 세선이 흐르고, 중지·약지만 그 위에 별똥별 궤적 포컬 포인트가 더해진다.',
    panels: [
      {
        slot: 'base',
        prompt:
          `${ZERO_TEXT_REPEAT} ${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ${FLOW_DIRECTIVE} ` +
          "This month's signature design: a glazed aurora pearl-chrome glaze blending lavender, powder blue, and mint like a soft night sky, with a glassy glossy top layer and real iridescent sheen. " +
          'Layered on top: just 2-3 hairline-thin mirror-bright silver-white foil streak lines, all following the one consistent diagonal flow direction described above (like faint meteor streaks all falling the same way) — simple and sparse, NOT a full shooting star with a star point, just the bare streak-line texture. A light dusting of tiny flat micro pearls like stardust. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${ZERO_TEXT_REPEAT} ${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ${FLOW_DIRECTIVE} ${ACCENT_SINGLE_MOTIF_LOCK} ` +
          "This month's signature design: a deep, richly saturated midnight-lavender/violet mirror-chrome gel lacquer — one continuous deep jewel-tone color across the whole panel, high-shine mirror-glossy top coat, soft directional highlight sheen, not flat, not faceted, not split into color blocks. " +
          'The one motif: a small delicate shooting-star silhouette (a four-point star with one long streaking tail, inspired by the dreamy pastel starscape reference, shape only — no moon, no constellation) in hairline-thin mirror-bright silver-white foil, near the center, oriented so its tail follows the same lower-left-to-upper-right diagonal flow as the base panel\'s streak lines, so both panels visually rhyme as one cohesive set. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
];

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const images = loadInspoImages();
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? CANDIDATES.filter((c) => args.includes(c.id)) : CANDIDATES;
  if (targets.length === 0) throw new Error(`알 수 없는 후보 id: ${args.join(', ')}`);

  for (const cand of targets) {
    console.log(`\n[${cand.id}] ${cand.label}`);
    console.log(`  조화 규칙: ${cand.compositionRule}`);
    for (const panel of cand.panels) {
      process.stdout.write(`  - ${panel.slot} 패널 생성 중… `);
      const outcome = await generateImage(images, panel.prompt);
      if (outcome.safetyBlocked) throw new Error(`[${cand.id}/${panel.slot}] 세이프티 차단됨 — 재실행 필요`);
      if (!outcome.image) throw new Error(`[${cand.id}/${panel.slot}] 이미지가 반환되지 않음`);
      const ext = outcome.image.mimeType.includes('png') ? 'png' : 'jpg';
      const outPath = resolve(OUT_DIR, `${cand.id}-${panel.slot}.${ext}`);
      writeFileSync(outPath, Buffer.from(outcome.image.data, 'base64'));
      console.log(`완료 → ${outPath}`);
    }
  }
  console.log('\n모든 텍스처 패널 생성 완료. /tmp/nailwork/v6-glaze-textures/를 육안으로 확인할 것.');
}

run().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
