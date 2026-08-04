/**
 * 히어로 네일아트 후보 4차 라운드 — 1단계: "아트 생성"과 "배치"를 분리한다.
 *
 *   npx tsx scripts/generate-nail-texture-v4.mts        (3개 후보의 텍스처 전부)
 *   npx tsx scripts/generate-nail-texture-v4.mts v4-1   (특정 후보만)
 *
 * 배경(사용자 지시, 2026-08-04): 2~3차 라운드는 손톱 하나짜리 작은 크롭을
 * 모델에게 직접 그리게 했는데, 이 방식은 모델을 "블록 채색"으로 후퇴시켰다
 * (v3 액센트 손톱의 각진 대각선 경계, 요청한 크롬 세선 라인아트 미구현,
 * v3-1 검지의 검은 아크 아티팩트/컷아웃 이음새). 이번 라운드는 "아트 생성"을
 * "손톱 배치"에서 완전히 분리한다:
 *   1단계(이 파일) — 손톱 모양과 무관하게, 큰 캔버스에 매니큐어 표면 디자인
 *     자체(오로라 글레이즈 레이어링, 포일 라인아트, 마이크로 펄, 그러데이션)를
 *     "디자인 시트/플랫 텍스처"로 생성한다. 손도 손톱도 아닌, 표면 재질 그
 *     자체를 요청 — 모델이 잘하는 태스크로 프레이밍을 바꾼다.
 *   2단계(scripts/generate-nail-candidates-v4.mts) — 이 텍스처를 손톱 5개
 *     마스크에 결정론적으로(코드로) 샘플링·워프·재조명해 합성한다.
 *
 * 텍스처는 커밋 대상이 아니므로 /tmp/nailwork/v4-textures/에 저장한다
 * (스크립트 소유 디렉터리 중 /tmp만 스크래치 산출물에 적합).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateImage } from '../lib/provider.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = '/tmp/nailwork/v4-textures';

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

const SURFACE_FRAME =
  'Macro flat-lay studio photograph of a nail polish design SWATCH CARD/SAMPLE PANEL — a flat rectangular material sample used by a Korean nail salon to show a manicure surface finish to clients, shot top-down and dead flat under soft even studio light. ' +
  'The design must fill the ENTIRE frame edge-to-edge as one continuous seamless surface — absolutely NOT a nail shape, NOT a finger, NOT a hand, NOT an isolated tip cutout, NOT on a white background: it is a full-bleed rectangular material swatch, like a fabric or metal-foil sample chip. ' +
  'High resolution, tack-sharp macro detail so every fine foil line, pearl grain, and gradient transition is crisp. Absolutely NO printed text, caption, title, label, logo, or watermark anywhere in the image — the image must contain zero letters and zero words, only the physical material surface. No ruler, no hand holding it.';

const HUMAN_ARTIST_LINES = [
  'Realism is the top priority: this must look like a real photographed gel-polish + foil + pearl-powder surface, buildable by hand by a skilled Korean nail artist — not a 3D render, not flat vector art, not a seamless tileable pattern-generator texture.',
  'Avoid the AI look entirely: no plastic waxy sheen, no oversaturated flat poster colors, no melted/blurred edges, no mannequin look.',
  'Keep believable hand-made character: natural gel thickness, real light falloff, tiny organic irregularity in linework — not computer-perfect symmetry.',
].join(' ');

interface TexturePanel {
  /** 파일명 접미사 (base | accent) */
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
    id: 'v4-1',
    label: '오로라 펄 크롬 + 딥 자수정 액센트 + 실버 포일 라인아트',
    panels: [
      {
        slot: 'base',
        prompt:
          `${SURFACE_FRAME} ` +
          "This month's signature nail-art surface design: glazed aurora pearl chrome. Soft pearlescent aurora film sheen shifting smoothly between lilac, ice blue, and champagne pink across the panel, like oil-on-water iridescence, with a glassy glossy top layer. " +
          'Layered on top: hairline-thin (about 1mm true scale) mirror-bright silver foil linework — a few elegant curving arcs and one or two delicate branching hairline strokes, like fine metallic thread laid over the glaze, with real specular metallic highlight distinct from the pearl base (not a same-tone painted line). ' +
          'Scatter a few tiny flat micro pearls (sub-millimeter, barely raised) along one edge of the linework for texture. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${SURFACE_FRAME} ` +
          "This month's signature nail-art surface design: a deep, richly saturated amethyst-violet mirror-chrome gel lacquer, one continuous deep jewel-tone color across the whole panel with a high-shine mirror-glossy top coat and soft directional highlight sheen (not flat, not faceted, not split into color blocks). " +
          'Layered on top: the exact same hairline-thin mirror-bright silver foil linework style (elegant curving arcs, delicate branching hairline strokes) as the aurora base panel, so the two panels visually rhyme as one cohesive manicure set despite the deeper base color. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
  {
    id: 'v4-2',
    label: '오로라 펄 크롬 + 딥 버건디 액센트 + 골드 포일 라인아트',
    panels: [
      {
        slot: 'base',
        prompt:
          `${SURFACE_FRAME} ` +
          "This month's signature nail-art surface design: glazed aurora pearl chrome. Soft pearlescent aurora film sheen shifting smoothly between lilac, ice blue, and champagne pink across the panel, like oil-on-water iridescence, with a glassy glossy top layer. " +
          'Layered on top: hairline-thin (about 1mm true scale) mirror-bright warm gold foil linework — a few elegant curving arcs and one or two delicate branching hairline strokes, like fine metallic thread laid over the glaze, with real specular metallic highlight distinct from the pearl base (not a same-tone painted line). ' +
          'Scatter a few tiny flat micro pearls (sub-millimeter, barely raised) along one edge of the linework for texture. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${SURFACE_FRAME} ` +
          "This month's signature nail-art surface design: a deep, richly saturated burgundy-wine mirror-chrome gel lacquer, one continuous deep jewel-tone color across the whole panel with a high-shine mirror-glossy top coat and soft directional highlight sheen (not flat, not faceted, not split into color blocks). " +
          'Layered on top: the exact same hairline-thin mirror-bright warm gold foil linework style (elegant curving arcs, delicate branching hairline strokes) as the aurora base panel, so the two panels visually rhyme as one cohesive manicure set despite the deeper base color. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
  {
    id: 'v4-3',
    label: '밀키 화이트 펄 크롬 + 딥 에메랄드 액센트 + 골드 마이크로 펄 라인아트',
    panels: [
      {
        slot: 'base',
        prompt:
          `${SURFACE_FRAME} ` +
          "This month's signature nail-art surface design: milky white pearl chrome glaze — a soft opalescent milky-white sheen with faint warm pink undertone, like a moonstone surface, glassy glossy top layer. " +
          'Layered on top: a delicate cluster of tiny flat gold micro-pearls (sub-millimeter) trailing along one soft curving hairline-thin gold foil arc near one edge, like a fine jewelry chain laid over the glaze, with real specular metallic-gold highlight distinct from the milky base. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
      {
        slot: 'accent',
        prompt:
          `${SURFACE_FRAME} ` +
          "This month's signature nail-art surface design: a deep, richly saturated emerald-green mirror-chrome gel lacquer, one continuous deep jewel-tone color across the whole panel with a high-shine mirror-glossy top coat and soft directional highlight sheen (not flat, not faceted, not split into color blocks). " +
          'Layered on top: the exact same tiny flat gold micro-pearls trailing along a soft curving hairline-thin gold foil arc as the milky base panel, so the two panels visually rhyme as one cohesive manicure set despite the deeper base color. ' +
          `${HUMAN_ARTIST_LINES}`,
      },
    ],
  },
];

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const args = process.argv.slice(2);
  const targets = args.length > 0 ? CANDIDATES.filter((c) => args.includes(c.id)) : CANDIDATES;
  if (targets.length === 0) throw new Error(`알 수 없는 후보 id: ${args.join(', ')}`);

  for (const cand of targets) {
    console.log(`\n[${cand.id}] ${cand.label} — 텍스처 패널 생성 시작 (공급자: ${process.env.IMAGE_PROVIDER})`);
    for (const panel of cand.panels) {
      process.stdout.write(`  - ${panel.slot} 패널 생성 중… `);
      const outcome = await generateImage([], panel.prompt);
      if (outcome.safetyBlocked) throw new Error(`[${cand.id}/${panel.slot}] 세이프티 차단됨 — 재실행 필요`);
      if (!outcome.image) throw new Error(`[${cand.id}/${panel.slot}] 이미지가 반환되지 않음`);
      const ext = outcome.image.mimeType.includes('png') ? 'png' : 'jpg';
      const outPath = resolve(OUT_DIR, `${cand.id}-${panel.slot}.${ext}`);
      writeFileSync(outPath, Buffer.from(outcome.image.data, 'base64'));
      console.log(`완료 → ${outPath}`);
    }
  }
  console.log('\n모든 텍스처 패널 생성 완료. /tmp/nailwork/v4-textures/를 육안으로 확인할 것.');
}

run().catch((e) => {
  console.error('실패:', e.message);
  process.exit(1);
});
