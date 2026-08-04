/**
 * 히어로 네일아트 후보 5차 라운드 — 1단계(재작업): 4차 라운드의 검증된 "대형
 * 재질 스와치 텍스처" 파이프라인을 그대로 쓰되, 네 장의 영감 사진(히어로에
 * 실제로 뜨는 tattoo/dreamy/fairycore/wings)을 참조 이미지로 첨부해 팔레트·
 * 모티프 언어를 그 사진들에서 가져온다.
 *
 *   npx tsx scripts/generate-nail-texture-v5.mts        (3개 후보 전부)
 *   npx tsx scripts/generate-nail-texture-v5.mts v5-1   (특정 후보만)
 *
 * 배경(중요한 실패 경로): 이 라운드는 처음에 "제품이 실제로 쓰는 생성 경로"를
 * 문자 그대로 따라 buildTipSetPrompt + generateImage에 영감 사진 4장을 참조로
 * 첨부해 팁 10개짜리 플랫레이 시트를 뽑고, 그 중 팁을 골라 이어붙여 4차
 * 파이프라인의 base/accent 패널 대신 쓰는 방식을 시도했다(스크립트는
 * generate-nail-candidates-v5.mts 커밋 이력 참고). 결과는 사용자 확인 결과
 * v4-2보다 명백히 후퇴: 실제 사진 팁을 그대로 크롭·이어붙이면 (1) 영감
 * 사진들이 원래 밝고 옅은 톤이라 팔레트가 통째로 창백해져 소형 히어로
 * 스케일에서 맨손과 구분이 안 됐고(v5-2 중지·약지가 거의 흰 무지로
 * 나옴 — 게이트2 확정 실패), (2) 사진 자체의 스튜디오 조명 스페큘러 하이라이트
 * 띠가 손톱 곡률과 무관한 곧은 흰 선으로 매핑돼 하드 이음새처럼 보였다(v5-1).
 * 진단: "사진에서 그대로 따온 밝기·구도"와 "4차 라운드가 확보한 진주광
 * 레이어링·금속 포일 세선·딥톤 액센트의 품질"이 충돌한다 — 유래를 사진
 * 밝기까지 강제하면 품질이 깎인다.
 *
 * 따라서 이번 재작업은 4차와 동일하게 "손톱 모양과 무관한 텍스트→이미지
 * 스와치 생성"으로 되돌리되(품질 기준선 절대 유지), 프롬프트에 네 장의
 * 영감 사진을 참조 이미지로 함께 첨부해(4차는 참조 이미지 없이 순수 텍스트만
 * 썼다 — 이번엔 실제로 사진을 보고 생성하게 함) 팔레트 힌트·모티프 언어(가는
 * 선 언어, 깃털 결, 별·초승달 라인, 하트·스크롤)만 가져오게 하고, 절대 채도·
 * 명도까지 사진을 따라가지 말라고 명시적으로 지시한다. 액센트 패널은 v4-2
 * 수준의 딥 톤(버건디/자수정)을 문구로 고정해 절대 파스텔로 washing out 되지
 * 않게 한다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from '../lib/provider.ts';
import type { ImagePayload } from '../lib/types.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = '/tmp/nailwork/v5-glaze-textures';

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
 * 네 장의 영감 사진에서 "가져올 것"과 "가져오지 말 것"을 명시하는 공통
 * 지시문(품질 우선). 1차 시도에서 accent 패널이 tattoo.webp의 실제 내용을
 * 그대로 베껴 한자/한글 글자(愛·明·落天使), 클로버 잎, 사과(과일), 티아라가
 * 박혀 나왔다(밴 목록 정면 위반: 글자·과일 모티프·장신구) — "모티프 언어만
 * 가져오라"는 지시만으로는 부족해서, 구체적으로 무엇을 금지하는지 나열한다.
 */
const DERIVATION_GUARDRAILS =
  'Four attached reference photos are this month\'s mood board (a fine-line tattoo-flash sheet, a dreamy pastel starscape, a whimsical fairycore sketch collage, and a pair of soft angel wings on a pink gradient) — pull ONLY their line-art vocabulary (delicate curving hairline strokes, wing feather flow, star/moon/heart/scroll shapes) and their color family (blush pink, lilac, powder blue/mint) into this design. ' +
  'Do NOT copy their pale washed-out brightness or low contrast — this design must still hit full glazed-glossy nail-salon saturation and shine, richer and more dimensional than the flat reference photos. ' +
  'Absolutely FORBIDDEN, even though they appear in the tattoo-flash reference photo: any Chinese characters, Korean characters (Hangul), Latin letters, words, or lettering of any kind anywhere in the image; any clover-leaf shape; any apple or fruit shape; any tiara, crown, or dangling jewelry charm shape. Reproduce none of the tattoo sheet\'s literal icons — only its fine hairline linework technique.';

interface TexturePanel {
  slot: 'base' | 'accent';
  prompt: string;
}
interface Candidate {
  id: string;
  label: string;
  panels: TexturePanel[];
}

const CANDIDATES: Candidate[] = [
  {
    id: 'v5-1',
    label: '폴른엔젤 글레이즈 — 오로라 펄 글레이즈 + 은장 날개/하트 라인아트 + 딥 로즈와인 액센트',
    panels: [
      {
        slot: 'base',
        prompt:
          `${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ` +
          "This month's signature design: a glazed aurora pearl-chrome glaze blending soft blush pink and lilac like the wing-gradient photo, with a glassy glossy top layer and real oil-on-water iridescent sheen. " +
          'Layered on top: hairline-thin (about 1mm true scale) mirror-bright silver foil linework tracing an elegant wing-feather curve and a small delicate heart-and-scroll flourish (inspired by the fine tattoo-flash line art, shapes only, no letters), with true specular metallic highlight distinct from the pearl base. Scatter a few tiny flat micro pearls along the linework like stardust. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ` +
          "This month's signature design: a deep, richly saturated rose-wine mirror-chrome gel lacquer (a deepened, jewel-tone version of the pink gradient behind the angel wings) — one continuous deep color across the whole panel, high-shine mirror-glossy top coat, soft directional highlight sheen, not flat, not faceted, not split into color blocks. " +
          'Layered on top: the exact same hairline-thin silver foil wing/heart linework style as the base panel, so both panels visually rhyme as one cohesive set. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
  {
    id: 'v5-2',
    label: '몽환 스타더스트 글레이즈 — 오로라 펄 글레이즈 + 은장 별/초승달 라인아트 + 딥 미드나잇 라벤더 액센트',
    panels: [
      {
        slot: 'base',
        prompt:
          `${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ` +
          "This month's signature design: a glazed aurora pearl-chrome glaze blending lavender, powder blue, and mint like a soft night sky, with a glassy glossy top layer and real iridescent sheen. " +
          'Layered on top: hairline-thin mirror-bright silver-white foil linework of a tiny shooting star, a few fine stars, and a slender crescent moon (inspired by the dreamy pastel starscape photo), with true specular metallic highlight. Scatter a light dusting of tiny flat micro pearls like stardust catching the light. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ` +
          "This month's signature design: a deep, richly saturated midnight-lavender/violet mirror-chrome gel lacquer — one continuous deep jewel-tone color across the whole panel, high-shine mirror-glossy top coat, soft directional highlight sheen, not flat, not faceted, not split into color blocks. " +
          'Layered on top: the exact same hairline-thin silver-white star/moon foil linework style as the base panel, so both panels visually rhyme as one cohesive set. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
  {
    id: 'v5-3',
    label: '페어리 라인아트 글레이즈 — 밀키 펄 글레이즈 + 금장 리본/플로럴 스케치 라인아트 + 딥 더스티로즈 액센트',
    panels: [
      {
        slot: 'base',
        prompt:
          `${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ` +
          "This month's signature design: a milky pearl-chrome glaze with a faint warm blush undertone (like a moonstone surface, inspired by the whimsical fairycore collage's soft wash), glassy glossy top layer. " +
          'Layered on top: extremely fine hairline-thin warm gold foil linework of a delicate ribbon curl and a tiny sprig of flowers (inspired by the fairycore sketch collage, line shapes only), with true specular metallic-gold highlight distinct from the milky base. A few tiny flat gold micro-pearls trail along the linework like dew drops. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${SURFACE_FRAME} ${DERIVATION_GUARDRAILS} ` +
          "This month's signature design: a deep, richly saturated dusty-rose/burgundy mirror-chrome gel lacquer — one continuous deep jewel-tone color across the whole panel, high-shine mirror-glossy top coat, soft directional highlight sheen, not flat, not faceted, not split into color blocks. " +
          'Layered on top: ONLY the exact same tiny gold micro-pearls trailing along a fine gold foil ribbon-curl line as the base panel, so both panels visually rhyme as one cohesive set — and absolutely nothing else. ' +
          'The surface must contain NOTHING beyond that one ribbon-curl line and its trailing pearls: no small circular badges, emblems, coins, or medallions of any kind; no clover leaf; no butterfly; no wing-and-heart icon; no extra motifs of any kind repeated across the surface. One deep color, one thin gold ribbon line, a few pearls — nothing more. ' +
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
    console.log(`\n[${cand.id}] ${cand.label} — 텍스처 패널 생성 시작 (공급자: ${process.env.IMAGE_PROVIDER}, 참조 4장 첨부)`);
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
  console.log('\n모든 텍스처 패널 생성 완료. /tmp/nailwork/v5-glaze-textures/를 육안으로 확인할 것.');
}

run().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
