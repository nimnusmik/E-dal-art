/**
 * 히어로 "변신 후 손" 네일아트 후보 2차 라운드 — 손톱 5개를 "개별" 크롭→생성→합성.
 *   npx tsx scripts/generate-nail-candidates-v2.mts        (3개 후보 전부)
 *   npx tsx scripts/generate-nail-candidates-v2.mts v2-2   (특정 후보만)
 *
 * 배경: 1차 라운드(task-2 이전)는 손 전체를 재생성해 정렬이 실패했고, 1.5차
 * 라운드(scripts/generate-nail-candidates.mts, 커밋 391841a)는 "손톱 5개짜리
 * 플랫레이 하나"를 생성해 컬럼 스캔으로 잘라 붙였다. 그 결과 사용자가 두 후보
 * 모두 반려했다: 손톱마다 아트가 오프셋/회전되어 있고, 일부는 거의 맨손톱으로
 * 보이고, 일부는 잘려서 "메니큐어"가 아니라 "스티커 붙인 느낌"이었다. 근본 원인은
 * 생성된 손톱 5개의 위치·각도가 실제 손과 무관한 좌표계(가상의 카탈로그 배치)라서,
 * 우리 고정 타원 마스크로 자르면 필연적으로 어긋난다는 점이었다.
 *
 * 이번 라운드의 지시사항(사용자 결정): 손톱 5개를 "각각 독립적으로", 그 손톱만
 * 타이트하게 크롭해서 생성한다 — 그러면 정렬 문제가 구조적으로 사라진다.
 *
 * **실측 검증(중요)**: 실제로 시도해보니 seedream 이미지 편집 엔드포인트는 크롭을
 * 그대로 "제자리 편집"하지 않는다 — 같은 손가락을 그럴듯하게 재구성하지만 완전히
 * 다른 캔버스 크기·구도(정사각형, 확대/재중심)로 반환한다(실측: 270×177 크롭을
 * 보냈는데 2048×2048에 손가락이 대각선으로 다시 배치되어 돌아옴 — 픽셀 위치를
 * 전혀 보존하지 않음). 따라서 "같은 좌표에 그대로 붙여넣기"는 애초에 불가능했다.
 * 대안으로 배경까지 자동 분할(피부 vs 손톱)해서 원본 위치에 재정합하는 방법도
 * 시도했으나, 손가락 표면의 조명 그라데이션 때문에 전역 임계값도 플러드필도
 * 손톱 경계에서 멈추지 못하고 손가락 전체로 새어나갔다(스크래치 테스트로 확인,
 * 커밋 대상 아님).
 *
 * **채택한 방식**: 각 손톱을 "참조 사진"으로 첨부해 모델에게 "이 손톱과 똑같은
 * 모양·비율·각도를 가진 press-on 팁 1개를, 흰 배경 위에 이번 달 디자인으로
 * 칠해서" 반환하라고 요청한다. 이러면:
 *   1. 이전 라운드의 실패 원인이었던 "손톱 5개짜리 플랫레이 1장"(컬럼 스캔이
 *      필요해 팁이 살짝 어긋나면 크롭이 깨짐)이 "손톱 1개짜리 컷아웃 1장"이 되어
 *      자동 크롭이 훨씬 견고해진다(객체가 하나뿐이라 컬럼 경계 자체가 없음).
 *   2. 팁마다 "그 손가락의 실제 사진"을 참조로 주므로, 모델이 억지로 만들어내는
 *      과거의 "카탈로그 임의 배치"보다 형태·각도·곡률의 사실감이 훨씬 높다(실측
 *      확인: 반환된 팁의 하이라이트가 둥근 손톱 표면처럼 자연스럽게 굽어 있음 —
 *      1.5차 라운드에서 지적된 "밋밋한 파스텔 워시" 문제가 여기서도 개선됨).
 *   3. 최종 정렬은 이전과 동일하게 "우리가 실측한 정확한 타원 마스크"에 맞춰
 *      리사이즈·회전해 배치한다 — 이번 라운드에서 마스크 좌표 자체를 전면
 *      재측정했으므로(scripts/nail-masks.mts 참고) 이 단계의 정확도가 크게
 *      올라갔다.
 *
 * 파이프라인(손톱 1개당):
 *   1. nailCropRect로 hand.webp에서 그 손톱만 넉넉히 크롭(주변 손끝 피부 포함).
 *   2. 크롭을 업스케일해 참조 이미지로 모델에 첨부, "이 손톱과 같은 모양의 팁 1개,
 *      흰 배경, 이번 달 디자인" 프롬프트로 생성.
 *   3. 반환된 이미지에서 흰 배경 대비 단일 객체를 자동 크롭 + 실루엣 알파 추출.
 *   4. 목적지 타원(2*rx × 2*ry)에 맞춰 리사이즈 → rotationDeg 회전 → 캔버스에 배치.
 *   5. NAIL_MASKS 알파(페더링)로 원본 위에만 블렌딩, 원본 손톱의 상대 밝기를
 *      약하게 되살려(기존 파이프라인과 동일한 검증된 블렌드) "도포된" 느낌을 낸다.
 *   6. 마스크 밖 픽셀·알파는 절대 건드리지 않음 — 원본과 항상 바이트 단위 동일.
 *
 * 5개 손톱을 하나의 세트로 통일감 있게 유지하기 위해, 후보마다 공통 팔레트/기법
 * 문구를 모든 손톱에 동일하게 주고, 1~2개 손톱에만 액센트 모티프를 추가한다.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateImage } from '../lib/provider.ts';
import { NAIL_MASKS, nailCropRect, type NailMask } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

const HUMAN_ARTIST_LINES = [
  'Realism is the top priority: indistinguishable from a real gel manicure done by a skilled Korean nail artist, shot for an editorial salon photo.',
  'Every element must be physically buildable by hand with gel, powder, film, and attachable parts — nothing floats, morphs, or defies gravity.',
  'Keep believable hand-made character: natural gel thickness and edge highlights — not computer-perfect symmetry.',
  'Avoid the AI look entirely: no plastic waxy texture, no oversaturated flat colors, no melted edges, no mannequin/3D-render look.',
  "Banned clichés — never include: 3D food charms (donut, candy, cake, fruit), ribbon bows, dangling rings or jewelry charms, rainbow sprinkles, cartoon characters, oversized 3D parts taller than the nail's curve, text, watermark, logos.",
  'Any decoration stays low-profile and refined (micro pearls, fine foil lines, thin hand-painted strokes, tiny flat studs) — small flat metal stars/moons resting on the surface are allowed.',
].join(' ');

interface Candidate {
  id: string;
  label: string;
  baseDesign: string;
  accentDesign: string;
  /** NAIL_MASKS 인덱스(0=엄지..4=소지) 중 액센트 모티프를 받을 손톱 */
  accentFingers: number[];
}

const CANDIDATES: Candidate[] = [
  {
    id: 'v2-1',
    label: '오로라 크롬 + 마이크로 별/달 스터드',
    baseDesign:
      "This month's signature design — glazed aurora chrome nail art. Soft pearlescent aurora film gradient shifting between lilac, ice blue, and champagne pink under studio light, painted as one smooth continuous color-shifting sheen with a glossy glass-like highlight — NO hard geometric edges or flat color blocks.",
    accentDesign:
      ' On this accent nail, add one or two tiny low-profile flat silver metal studs shaped like a star or crescent moon, placed near the cuticle, resting flat on the glossy surface with a small realistic drop shadow.',
    accentFingers: [1, 3], // 검지, 약지
  },
  {
    id: 'v2-2',
    label: '딥 주얼톤 글레이즈 + 파인 라인아트 + 골드 플레크',
    baseDesign:
      "This month's signature design — a rich solid burgundy-espresso gel polish, ONE single smooth even color across the entire nail (like a classic wet-look lacquer, not a two-tone or multi-color design), high-shine mirror-glossy top coat, subtle fine gold micro-flecks embedded in the gel catching the light (not glitter clumps). Do not add any second color, any color-blocking, or any faceted pattern — just one deep solid color with a glossy shine.",
    accentDesign:
      ' On this accent nail, add fine hand-painted cream-colored linework tracing thin abstract curves or a minimal floral line near the cuticle, confidently visible against the dark base.',
    accentFingers: [2], // 중지
  },
  {
    id: 'v2-3',
    label: '세이지 그린 x 버터크림 투톤 + 델리케이트 라인아트',
    baseDesign:
      "This month's signature design — a confident two-tone glazed gel manicure using EXACTLY 2 colors total, never 3, never 4: roughly two-thirds of the nail from the cuticle in soft sage green, and the remaining one-third toward the free edge in a warm buttercream tone — only ONE boundary line between them, a soft hand-painted diagonal curve (not a hard geometric edge, not a straight ruler-line). Glossy high-shine finish, clearly visible color contrast between the two tones (not washed out or pastel-faded). This is a simple two-color block design, not a multi-facet or multi-triangle pattern.",
    accentDesign:
      ' On this accent nail, add a very thin hand-painted fine gold line following the diagonal color-block boundary, plus one single small micro pearl placed precisely near the cuticle.',
    accentFingers: [0, 4], // 엄지, 소지
  },
];

/**
 * 흰 배경 위 손톱 팁 "단일 객체" 컷아웃을 자동 크롭한다 — 손톱 1개짜리 결과라
 * 컬럼 스캔이 필요 없다(1.5차 라운드의 5분할 컬럼 스캔보다 훨씬 견고함).
 *
 * **버그(실측으로 발견, 수정함)**: 처음엔 "배경색과의 거리 > 임계값이면 전경"으로
 * 픽셀 단위 분류했는데, 오로라 크롬처럼 밝고 옅은 파스텔 디자인은 손톱 안쪽인데도
 * 흰 배경과 색 거리가 가까워 "배경"으로 잘못 분류되는 픽셀이 많았다. 그 결과 합성된
 * 손톱에 원본 맨손톱이 그대로 비치는 구멍(특히 큐티클 쪽 쐐기 모양)이 생겼다 —
 * v2-1 1차 실행에서 검지·약지가 거의 맨손톱으로 보인 원인이 이것이었다(육안 확인).
 * 고침: "배경"을 픽셀 단위 색 거리가 아니라 "이미지 테두리에서부터 흰색과 비슷한
 * 픽셀을 따라 연결되는 영역"으로 정의한다(테두리에서 시작하는 BFS). 손톱 내부의
 * 옅은 하이라이트는 진짜 배경과 연결되어 있지 않으므로 항상 전경으로 남는다 —
 * 손톱 몸통 내부에 구멍이 뚫릴 수 없는 구조.
 */
export async function autocropSingleTip(tipBuf: Buffer): Promise<Buffer> {
  const { data, info } = await sharp(tipBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  const bgR = 255, bgG = 255, bgB = 255;
  const BG_DIST = 28;
  const isWhiteish = (i: number): boolean => {
    const p = i * 4;
    return Math.abs(data[p] - bgR) + Math.abs(data[p + 1] - bgG) + Math.abs(data[p + 2] - bgB) < BG_DIST;
  };

  // 테두리에서 시작하는 BFS로 "진짜 배경"(테두리와 흰색 픽셀로 연결된 영역)만 표시.
  const isBg = new Uint8Array(W * H);
  const stack: number[] = [];
  for (let x = 0; x < W; x++) {
    for (const y of [0, H - 1]) {
      const idx = y * W + x;
      if (isWhiteish(idx) && !isBg[idx]) { isBg[idx] = 1; stack.push(idx); }
    }
  }
  for (let y = 0; y < H; y++) {
    for (const x of [0, W - 1]) {
      const idx = y * W + x;
      if (isWhiteish(idx) && !isBg[idx]) { isBg[idx] = 1; stack.push(idx); }
    }
  }
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const y = Math.floor(idx / W), x = idx - y * W;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const n = ny * W + nx;
      if (!isBg[n] && isWhiteish(n)) { isBg[n] = 1; stack.push(n); }
    }
  }
  const isFg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) isFg[i] = isBg[i] ? 0 : 1;

  // 최대 연결요소(BFS) — 반환 이미지에 잡음(경계 안티앨리어싱 등)이 있어도
  // 진짜 팁 몸통만 골라낸다.
  const visited = new Uint8Array(W * H);
  let best = { size: 0, left: W, right: -1, top: H, bottom: -1 };
  const stack2: number[] = [];
  for (let idx0 = 0; idx0 < W * H; idx0++) {
    if (!isFg[idx0] || visited[idx0]) continue;
    let size = 0, left = W, right = -1, top = H, bottom = -1;
    stack2.push(idx0); visited[idx0] = 1;
    while (stack2.length > 0) {
      const idx = stack2.pop()!;
      const y = Math.floor(idx / W), x = idx - y * W;
      size++;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      for (const n of [idx - 1, idx + 1, idx - W, idx + W]) {
        if (n < 0 || n >= W * H) continue;
        const ny = Math.floor(n / W), nx = n - ny * W;
        if (Math.abs(nx - x) > 1) continue;
        if (isFg[n] && !visited[n]) { visited[n] = 1; stack2.push(n); }
      }
    }
    if (size > best.size) best = { size, left, right, top, bottom };
  }
  if (best.size === 0) throw new Error('반환된 팁 이미지에서 전경을 찾지 못함 — 재생성 필요');

  // 최종 알파는 "최대 연결요소의 bbox 안에서는, isBg가 아닌 모든 픽셀"로 채운다
  // (연결요소 자체가 아니라 bbox 내부 전체를 전경 후보로 다시 채워, 자잘한
  // BFS 단절로 생긴 미세한 내부 구멍까지 확실히 메운다).
  const pad = 6;
  const cropLeft = Math.max(0, best.left - pad);
  const cropTop = Math.max(0, best.top - pad);
  const cropW = Math.min(W, best.right + pad) - cropLeft;
  const cropH = Math.min(H, best.bottom + pad) - cropTop;

  const rgb = await sharp(tipBuf).extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH }).removeAlpha().raw().toBuffer();
  const alphaBuf = Buffer.alloc(cropW * cropH);
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const gx = cropLeft + x, gy = cropTop + y;
      alphaBuf[y * cropW + x] = isBg[gy * W + gx] ? 0 : 255;
    }
  }
  const featheredAlpha = await sharp(alphaBuf, { raw: { width: cropW, height: cropH, channels: 1 } }).blur(2).raw().toBuffer();
  const rgba = Buffer.alloc(cropW * cropH * 4);
  for (let i = 0; i < cropW * cropH; i++) {
    rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1]; rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = featheredAlpha[i];
  }
  return sharp(rgba, { raw: { width: cropW, height: cropH, channels: 4 } }).png().toBuffer();
}

/** 채널별 밝기(단순 가중 평균) */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 손톱 1개의 팁 텍스처를 목적지 타원(cx,cy,rx,ry,rotationDeg) 위치에 맞춰
 * W×H 전체 캔버스로 만든다(1.5차 라운드의 buildGenCanvas와 동일한 방식,
 * 이번엔 텍스처가 팁 5장짜리 배열이 아니라 손톱마다 독립 호출).
 */
export async function placeTipOnCanvas(tip: Buffer, m: NailMask, W: number, H: number): Promise<Buffer> {
  const OVERSCAN = 1.15; // 텍스처 실루엣이 타원보다 좁을 때 가장자리에 원본이 비치는 문제 방지
  const tileW = Math.round(m.rx * 2 * OVERSCAN);
  const tileH = Math.round(m.ry * 2 * OVERSCAN);
  const resized = await sharp(tip).resize(tileW, tileH, { fit: 'fill' }).png().toBuffer();
  const rotated = await sharp(resized).rotate(m.rotationDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const rMeta = await sharp(rotated).metadata();
  const left = Math.round(m.cx - rMeta.width! / 2);
  const top = Math.round(m.cy - rMeta.height! / 2);
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: rotated, left, top, blend: 'over' }])
    .raw().toBuffer();
}

/**
 * 손톱 하나를 원본 위에 합성한다 — 색상/패턴은 텍스처, 밝기는 원본 손톱의
 * 상대 밝기를 곱셈 블렌드로 살짝 되살린다(1.5차 라운드에서 워시아웃 버그를
 * 고쳐 검증된 계수를 그대로 사용: 상한 1.25배, 반영 강도 0.35).
 */
function compositeOneNail(canvas: Buffer, genRgba: Buffer, maskAlpha: Buffer, W: number, H: number): void {
  let sumL = 0, sumW = 0;
  for (let i = 0; i < W * H; i++) {
    const a = maskAlpha[i];
    if (a === 0) continue;
    const p = i * 4;
    const L = luminance(canvas[p], canvas[p + 1], canvas[p + 2]);
    sumL += L * (a / 255);
    sumW += a / 255;
  }
  const avgL = sumW > 0 ? sumL / sumW : 128;

  for (let i = 0; i < W * H; i++) {
    const a = maskAlpha[i];
    if (a === 0) continue;
    const p = i * 4;
    const genA = genRgba[p + 3];
    if (genA === 0) continue;
    const origL = luminance(canvas[p], canvas[p + 1], canvas[p + 2]);
    const shadeFactor = Math.min(1.25, Math.max(0.75, origL / Math.max(avgL, 1)));
    const mix = 0.35;
    const w = (a / 255) * (genA / 255);
    for (let c = 0; c < 3; c++) {
      const genV = genRgba[p + c];
      const shaded = Math.min(255, Math.max(0, genV * shadeFactor));
      const designV = genV * (1 - mix) + shaded * mix;
      canvas[p + c] = Math.round(canvas[p + c] * (1 - w) + designV * w);
    }
    // canvas[p+3](알파)는 절대 건드리지 않음 — 원본과 항상 동일
  }
}

export async function generateOneNailTip(m: NailMask, cand: Candidate, isAccent: boolean, W: number, H: number): Promise<Buffer> {
  const crop = nailCropRect(m, W, H);
  const cropBuf = await sharp(SRC).extract(crop).flatten({ background: '#ffffff' }).png().toBuffer();
  const upscale = 900;
  const scale = upscale / Math.max(crop.width, crop.height);
  const refBuf = await sharp(cropBuf).resize(Math.round(crop.width * scale), Math.round(crop.height * scale)).png().toBuffer();

  const designLine = cand.baseDesign + (isAccent ? cand.accentDesign : '');
  const prompt =
    `The attached photo is a close-up reference of one real human fingertip (${m.name}) with a bare natural nail, viewed top-down. ` +
    `Study the exact shape, proportions, curvature, and viewing angle of THIS SPECIFIC nail. ` +
    `Now output ONE photorealistic top-down photo of a SINGLE press-on nail tip cutout, isolated on a clean plain white background like a studio product photo, ` +
    `that matches this nail's shape, proportions, curvature, and viewing angle as closely as possible — short-to-medium length, soft round/square shape matching a natural manicure (NOT a long almond or stiletto extension). ` +
    `Paint it with this month's finished glossy gel manicure design: ${designLine} ` +
    `The polish must fully cover the ENTIRE nail plate edge-to-edge, all the way up to the cuticle line and out to both side walls and the free edge — ` +
    `absolutely no bare, unpainted, or clear patch anywhere on the nail, not even a thin sliver near the cuticle. ` +
    `Lighting must be soft and even across the whole nail: avoid one single hard bright specular streak or glare band; the color and finish must read consistently over the whole surface, not just in a narrow diagonal band. ` +
    `CRITICAL — avoid a common rendering failure: do NOT split the nail into multiple flat geometric facets, triangles, or a angular "gem-cut"/pinwheel pattern of 3-4 different flat color wedges meeting at sharp points. ` +
    `Any color transition on the nail must be ONE continuous soft painterly gradient or a single soft-edged brushstroke division — never more than one boundary line, and that boundary must be a gentle curve or soft-feathered edge, never a sharp geometric angle. ` +
    `${HUMAN_ARTIST_LINES} ` +
    `Soft even studio lighting, subtle shadow directly under the tip. Only the nail tip is the subject — no finger, no skin, no hand, no packaging, no text.`;

  const outcome = await generateImage([{ data: refBuf.toString('base64'), mimeType: 'image/png' }], prompt);
  if (outcome.safetyBlocked) throw new Error(`[${cand.id}/${m.name}] 세이프티 차단됨 — 재실행 필요`);
  if (!outcome.image) throw new Error(`[${cand.id}/${m.name}] 이미지가 반환되지 않음`);
  const rawTip = Buffer.from(outcome.image.data, 'base64');
  return autocropSingleTip(rawTip);
}

async function buildCandidate(
  cand: Candidate,
  W: number,
  H: number,
  origRgba: Buffer,
  maskAlphas: Buffer[],
  onlyFingerIdx: number[] | null,
): Promise<void> {
  console.log(`\n[${cand.id}] ${cand.label} — 손톱 5개 개별 생성 시작 (공급자: ${process.env.IMAGE_PROVIDER})`);
  // 손톱 luminance 참조는 항상 "맨손톱 원본"이어야 한다(이미 그려진 디자인 위에
  // 또 블렌드하면 색이 겹쳐 번짐) — 그래서 캔버스는 항상 원본에서 시작한다.
  const canvas = Buffer.from(origRgba);

  // --fingers로 일부만 재생성할 때: 재생성 대상이 아닌 손톱은 "이전에 이미 저장된
  // 이 후보 파일"의 픽셀을 그대로 복사해 온다(다시 생성하지 않고 보존) — 그래야
  // 특정 손톱만 재시도해도 나머지 4개가 맨손톱으로 되돌아가지 않는다.
  const outPath = resolve(OUT_DIR, `${cand.id}.webp`);
  if (onlyFingerIdx) {
    try {
      const { data: prevRgba } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < NAIL_MASKS.length; i++) {
        if (onlyFingerIdx.includes(i)) continue; // 이 손톱은 새로 생성할 것이므로 건너뜀
        const alpha = maskAlphas[i];
        for (let p = 0; p < W * H; p++) {
          const a = alpha[p];
          if (a === 0) continue;
          const q = p * 4;
          const w = a / 255;
          canvas[q] = Math.round(canvas[q] * (1 - w) + prevRgba[q] * w);
          canvas[q + 1] = Math.round(canvas[q + 1] * (1 - w) + prevRgba[q + 1] * w);
          canvas[q + 2] = Math.round(canvas[q + 2] * (1 - w) + prevRgba[q + 2] * w);
        }
      }
      console.log(`  (이전 저장본에서 재생성 대상 외 손톱을 보존)`);
    } catch {
      console.log(`  (이전 저장본 없음 — 지정된 손톱 외에는 맨손톱으로 저장됨에 유의)`);
    }
  }

  for (let i = 0; i < NAIL_MASKS.length; i++) {
    if (onlyFingerIdx && !onlyFingerIdx.includes(i)) continue;
    const m = NAIL_MASKS[i];
    const isAccent = cand.accentFingers.includes(i);
    process.stdout.write(`  - ${m.name}${isAccent ? '(액센트)' : ''} 생성 중… `);
    const tip = await generateOneNailTip(m, cand, isAccent, W, H);
    const genRgba = await placeTipOnCanvas(tip, m, W, H);
    compositeOneNail(canvas, genRgba, maskAlphas[i], W, H);
    console.log('완료');
  }

  await sharp(canvas, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(outPath);
  console.log(`  저장 완료: ${outPath}`);
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;
  const { data: origRgba } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // 손톱마다 "그 손톱만" 표시된 개별 페더링 알파(전체 캔버스 크기) — 다른 손톱
  // 영역과 겹치지 않도록 각자 따로 래스터라이즈한다.
  const sharpMod = (await import('sharp')).default;
  const maskAlphas: Buffer[] = [];
  for (const m of NAIL_MASKS) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="black"/>`;
    svg += `<g transform="rotate(${m.rotationDeg} ${m.cx} ${m.cy})"><ellipse cx="${m.cx}" cy="${m.cy}" rx="${m.rx}" ry="${m.ry}" fill="white"/></g></svg>`;
    const { data } = await sharpMod(Buffer.from(svg)).blur(1.2).greyscale().raw().toBuffer({ resolveWithObject: true });
    maskAlphas.push(data);
  }

  // CLI: npx tsx scripts/generate-nail-candidates-v2.mts [candId...] [--fingers=중지,약지]
  const args = process.argv.slice(2);
  const fingersArg = args.find((a) => a.startsWith('--fingers='));
  const only = args.filter((a) => !a.startsWith('--'));
  const targets = only.length > 0 ? CANDIDATES.filter((c) => only.includes(c.id)) : CANDIDATES;
  if (targets.length === 0) throw new Error(`알 수 없는 후보 id: ${only.join(', ')}`);
  const onlyFingerIdx = fingersArg
    ? fingersArg
        .slice('--fingers='.length)
        .split(',')
        .map((name) => NAIL_MASKS.findIndex((m) => m.name === name))
    : null;

  for (const cand of targets) {
    await buildCandidate(cand, W, H, origRgba, maskAlphas, onlyFingerIdx);
  }
  console.log('\n모든 후보 생성 완료. ref/nail-candidates/v2-*.webp를 육안으로 확인할 것.');
}
// 이 파일을 직접 실행했을 때만 run()을 돌린다 — 디버그 스크립트가 위 헬퍼
// 함수들(autocropSingleTip 등)을 재사용하려고 이 모듈을 import만 해도 run()이
// 같이 실행돼버리는 사고가 있었다(실측으로 발견: 스크래치 디버그 스크립트를
// 돌릴 때마다 진짜 3후보×5손톱 생성이 백그라운드에서 조용히 같이 시작되어
// API 호출과 결과 파일을 낭비/덮어씀). import만으로는 부작용이 없어야 한다.
const isMainModule = process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`;
if (isMainModule) {
  run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
}
