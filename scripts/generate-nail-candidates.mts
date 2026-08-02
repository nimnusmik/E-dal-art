/**
 * 히어로 "변신 후 손" 네일아트 후보 생성 (손 재생성 대신 손톱 영역만 합성).
 *   npx tsx scripts/generate-nail-candidates.mts
 *
 * 배경: 기존 방식(손 전체를 이미지 모델로 재생성 후 정렬 보정)은 두 가지 문제가 있었다.
 *   1. 손 전체 재생성 + 아핀 정렬 보정 과정에서 알파 외곽선이 계단지고 피부 질감이 손상됨.
 *   2. 네일 디자인 자체가 밋밋한 펄 블롭 수준으로 예쁘지 않음.
 * 새 방식: hand.webp 픽셀은 절대 건드리지 않는다. scripts/nail-masks.mts에 하드코딩된
 * 손톱 5개의 페더링된 타원 마스크 "안쪽"에만 새로 생성한 네일아트를 합성한다.
 *
 * **1차 시도(폐기)**: hand.webp 자체를 크로마 그린으로 모델에 보내 "손톱만 바꿔서"
 * 재생성한 뒤, 알파 바운딩박스 기준으로 스케일/평행이동만 보정해 우리 고정 마스크에
 * 끼워 맞추려 했다. 그러나 전역 바운딩박스 보정은 손가락 개별 포즈(간격·각도)의 미세한
 * 드리프트까지는 못 잡아서, 우리 마스크가 실제 손톱 위치를 살짝 벗어나 생성본의
 * "초록 배경(키아웃 후 알파=0 → RGB를 검게 만듦)"을 그대로 물어와 손톱 위에 검은
 * 반달이 찍히는 결함이 발생했다(육안 확인으로 발견, 재사용 금지).
 *
 * **채택한 방식**: 손 사진과 완전히 분리해서, 흰 배경 위에 손톱 팁 5개를 한 줄로
 * 나란히 그린 "플랫레이 텍스처"만 생성한다(그린스크린도, 손도, 정렬 보정도 필요 없음 —
 * 애초에 손 좌표계와 무관하므로 정렬 실패라는 개념 자체가 없다). 각 팁을 자동 크롭한 뒤,
 * 손톱마다 크기·회전을 맞춰 우리 고정 타원 마스크 위치에 얹는다. 마스크 밖 픽셀은
 * 원본 hand.webp와 항상 바이트 단위로 동일 — 외곽선·알파·피부 문제가 구조적으로 없다.
 *
 * 파이프라인:
 *   1. buildTipSetPrompt류 프롬프트로 "5개 손톱 팁, 한 줄, 흰 배경" 플랫레이 생성.
 *   2. 흰 배경 임계값으로 각 팁의 바운딩박스를 자동 크롭(5등분 컬럼 스캔).
 *   3. 각 팁을 해당 손톱 마스크의 (2*rx × 2*ry) 크기로 리사이즈 → rotationDeg만큼 회전
 *      → 알파 있는 낱장 텍스처를 W×H 캔버스 위 (cx,cy) 중심에 합성 → "가상 생성본" 완성.
 *   4. NAIL_MASKS 알파(페더링됨)를 가중치로 원본 hand.webp 위에만 블렌딩.
 *      - 색상/패턴은 텍스처에서, 밝기는 원본 손톱의 상대 밝기(하이라이트·음영)를 곱셈
 *        블렌드로 살짝 되살려 "스티커"가 아니라 "그 손톱에 실제로 도포된" 느낌을 낸다.
 *      - 마스크 밖 픽셀은 손대지 않음 → 원본과 바이트 단위 동일.
 *   5. 결과는 1000×1796, 알파는 원본을 그대로 재사용(전혀 변경 없음).
 *
 * 4개 후보를 서로 다른 팔레트/모티프 언어로 생성해 ref/nail-candidates/cand-N.webp에 저장.
 * public/hero/hand-after.webp는 덮어쓰지 않는다 — 사용자가 먼저 고른다.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateImage } from '../lib/provider.ts';
import { NAIL_MASKS, renderNailMaskAlpha } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

// 사람 아티스트가 실제로 만들 수 있는 디자인처럼 보이게 하는 공통 제약(lib/prompt.ts의
// HUMAN_ARTIST_LINES와 같은 원칙, 이 스크립트는 손 사진이 아니라 팁 플랫레이용이라 문구만 조정).
const COMMON = [
  'Create ONE photorealistic top-down flat-lay photo of exactly 5 individual press-on nail tips,',
  'arranged in a single STRICTLY HORIZONTAL row, all 5 tips centered at the exact same height',
  '(like a ruler / product catalog swatch strip) — NOT diagonal, NOT staggered, NOT overlapping,',
  'evenly spaced with equal, clearly visible gaps of plain white background between each tip,',
  'on a clean plain white background, soft even top-down studio lighting, subtle soft shadow directly under each tip.',
  'Each tip is oval/almond shaped, short-to-medium length, shown upright and vertical (cuticle end at the bottom, free edge at the top), viewed straight top-down.',
  'Realism is the top priority: indistinguishable from a real gel manicure done by a skilled Korean nail artist, shot for an editorial salon photo.',
  'Every element must be physically buildable by hand with gel, powder, film, and attachable parts — nothing floats, morphs, or defies gravity.',
  'Keep believable hand-made character: micro-variations between the 5 tips, natural gel thickness and edge highlights — not computer-perfect symmetry.',
  'Avoid the AI look entirely: no plastic waxy texture, no oversaturated colors, no melted edges, no mannequin/3D-render look.',
  'Banned clichés — never include: 3D food charms (donut, candy, cake, fruit), ribbon bows, dangling rings or jewelry charms,',
  'rainbow sprinkles, cartoon characters, oversized 3D parts taller than the nail’s curve, text, watermark, logos.',
  'Any decoration stays low-profile and refined (micro pearls, fine foil lines, thin hand-painted strokes, tiny flat studs).',
  'The 5 tips are the only subject: no hands, no fingers, no packaging.',
].join(' ');

/** 4개 후보 — 팔레트·모티프 언어를 뚜렷이 다르게 (품질 기준: 이달의 아트, 실제로 예뻐야 함) */
const CANDIDATES: { id: string; label: string; design: string }[] = [
  {
    id: 'cand-1',
    label: '오로라 크롬 + 마이크로 별/달',
    design:
      "This month's signature design — glazed aurora chrome nail art. " +
      'Base: soft pearlescent aurora film gradient shifting between lilac, ice blue, and champagne pink under studio light, ' +
      'painted as one smooth continuous color-shifting sheen — NO hard geometric edges or flat color blocks, only a soft painterly blend. ' +
      'Fine hand-painted silver linework tracing delicate arcs near the cuticle on 2-3 of the tips. ' +
      'Tiny low-profile chrome micro studs shaped like stars and crescent moons placed sparsely and asymmetrically (not on every tip). ' +
      'Micro pearls scattered lightly near the cuticle line on one accent tip. ' +
      'IMPORTANT: all 5 tips must clearly show the aurora color design — none of the 5 tips may look bare, undecorated, or plain clear/natural. ' +
      'Each of the 5 tips is a related but distinct variation of this theme — not identical copies.',
  },
  {
    id: 'cand-2',
    label: '밀키 화이트 프렌치 + 골드 라인아트',
    design:
      "This month's signature design — sheer milky white base with a soft glazed donut-skin finish. " +
      'Delicate fine-line French tips in warm champagne gold — the gold line must be clearly visible and crisp against the milky base, ' +
      'with confident color contrast (not faint or washed out), slightly irregular hand-painted edge (not a perfect machine line). ' +
      'On one or two accent tips, ultra-fine gold linework forming a minimal abstract wave or line-art motif near the cuticle. ' +
      'A few single micro pearls placed precisely, never clustered. ' +
      'IMPORTANT: the French gold tip-line must be clearly visible on all 5 tips — do not render any tip as plain bare/undecorated white. ' +
      'Each of the 5 tips is a related but distinct variation of this theme — not identical copies.',
  },
  {
    id: 'cand-3',
    label: '딥 주얼톤 글레이즈 + 파인 라인아트',
    design:
      "This month's signature design — deep jewel-tone glazed gel in muted burgundy and espresso brown with a glossy glass-like sheen. " +
      'Fine hand-painted cream-colored linework tracing thin abstract curves or a minimal floral line on 1-2 accent tips. ' +
      'Subtle fine gold micro-flecks embedded in the gel catching the light, not glitter clumps. ' +
      'Each of the 5 tips is a related but distinct variation of this theme — not identical copies.',
  },
  {
    id: 'cand-4',
    label: '파스텔 그라데이션 옴브레 + 저프로필 스터드',
    design:
      "This month's signature design — soft pastel ombre gradient blending sage green into buttery cream from cuticle to tip, glazed glossy finish. " +
      'The gradient must be ONE smooth continuous airbrushed transition, gradually blending color across the whole nail — ' +
      'absolutely NO hard edge, NO diagonal split, NO two flat blocks of solid color; it must never look like two separate colors stitched together. ' +
      'On 1-2 accent tips, a very thin hand-painted fine gold line following the smile line of the cuticle. ' +
      'A couple of tiny low-profile matte gold micro studs placed asymmetrically near the base of one or two tips. ' +
      'Each of the 5 tips is a related but distinct variation of this theme — not identical copies.',
  },
];

/** 채널별 밝기(단순 가중 평균) */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 흰 배경 플랫레이에서 팁 5개를 컬럼 스캔 + 연결요소(BFS)로 자동 크롭한다.
 * 단순 바운딩박스 방식은 팁이 살짝 비스듬히 배치되면(모델이 지시를 완벽히 안 지킴)
 * 컬럼 안의 빈 흰 여백까지 bbox에 포함시켜 손톱이 작게 쪼그라드는 문제가 있었다
 * (1차 시도에서 실측 — 결과물이 대부분 흰색이고 손톱이 귀퉁이에 작게 찍힘).
 * 컬럼 경계로 flood-fill을 제한한 뒤 "가장 큰 연결 성분"만 골라 그 bbox를 쓰면,
 * 컬럼 안의 빈 여백이나 옆 팁이 살짝 걸친 조각이 아니라 진짜 팁 몸통만 잡힌다.
 */
async function autocropTips(flatlay: Buffer): Promise<Buffer[]> {
  const { data, info } = await sharp(flatlay).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  // 배경색을 절대 임계값(>245)으로 가정하지 않는다 — 실측 결과 모델이 반환한
  // "흰 배경"이 (235,234,239)처럼 순백이 아닌 경우가 있었다(1차 시도에서 발견:
  // 배경 전체가 전경으로 오분류되어 컬럼 전체가 하나의 거대한 연결 성분이 됨 →
  // 팁이 크롭 하단에 작게 쪼그라듦). 대신 네 모서리에서 배경색을 실측해 그 색과의
  // 거리로 전경/배경을 판정한다.
  const corners = [
    [2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3],
  ];
  let bgR = 0, bgG = 0, bgB = 0;
  for (const [cx, cy] of corners) {
    const p = (cy * W + cx) * 4;
    bgR += data[p]; bgG += data[p + 1]; bgB += data[p + 2];
  }
  bgR /= corners.length; bgG /= corners.length; bgB /= corners.length;
  const BG_DIST = 18; // 배경색과의 유클리드 거리(채널별 절대차 합)가 이보다 크면 전경

  const colW = W / 5;
  const crops: Buffer[] = [];
  for (let k = 0; k < 5; k++) {
    const colLeft = Math.floor(k * colW);
    const colRight = Math.min(W, Math.ceil((k + 1) * colW));
    const cw = colRight - colLeft;
    const isFg = new Uint8Array(cw * H);
    for (let y = 0; y < H; y++) {
      for (let x = colLeft; x < colRight; x++) {
        const p = (y * W + x) * 4;
        const r = data[p], g = data[p + 1], b = data[p + 2];
        const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        if (dist > BG_DIST) isFg[y * cw + (x - colLeft)] = 1;
      }
    }
    // 연결요소 라벨링(BFS) — 가장 큰 성분의 bbox를 찾는다
    const visited = new Uint8Array(cw * H);
    let best = { size: 0, left: cw, right: -1, top: H, bottom: -1 };
    const stack: number[] = [];
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < cw; x++) {
        const idx0 = y * cw + x;
        if (!isFg[idx0] || visited[idx0]) continue;
        let size = 0, left = cw, right = -1, top = H, bottom = -1;
        stack.push(idx0); visited[idx0] = 1;
        while (stack.length > 0) {
          const idx = stack.pop()!;
          const cy = Math.floor(idx / cw), cx = idx - cy * cw;
          size++;
          if (cx < left) left = cx;
          if (cx > right) right = cx;
          if (cy < top) top = cy;
          if (cy > bottom) bottom = cy;
          const neighbors = [idx - 1, idx + 1, idx - cw, idx + cw];
          for (const n of neighbors) {
            if (n < 0 || n >= cw * H) continue;
            const ny = Math.floor(n / cw), nx = n - ny * cw;
            if (Math.abs(nx - cx) > 1) continue; // 좌우 경계 랩어라운드 방지
            if (isFg[n] && !visited[n]) { visited[n] = 1; stack.push(n); }
          }
        }
        if (size > best.size) best = { size, left, right, top, bottom };
      }
    }
    if (best.size === 0) {
      throw new Error(`팁 ${k + 1}번 컬럼에서 내용을 찾지 못함 — 플랫레이 레이아웃이 예상과 다름, 재생성 필요`);
    }
    const pad = 4;
    const cropLeft = Math.max(colLeft, colLeft + best.left - pad);
    const cropTop = Math.max(0, best.top - pad);
    const cropW = Math.min(colRight, colLeft + best.right + pad) - cropLeft;
    const cropH = Math.min(H, best.bottom + pad) - cropTop;

    // 팁 모양대로 실제 알파를 입힌다(사각 bbox 그대로 쓰면 팁 바깥 흰 배경 모서리가
    // 목적지 타원 마스크 크기/비율이 다를 때 하얗게 번져 보이는 문제가 있었다 — 실측
    // 확인: 결과물 손톱 좌우에 흰 띠가 생김). isFg(전경 판정)를 알파로 써서 팁의
    // 진짜 손톱 실루엣 밖은 투명하게 만든 뒤, 살짝 블러로 페더링한다.
    const rgb = await sharp(flatlay).extract({ left: cropLeft, top: cropTop, width: cropW, height: cropH }).removeAlpha().raw().toBuffer();
    const alphaBuf = Buffer.alloc(cropW * cropH);
    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const gx = cropLeft - colLeft + x, gy = cropTop + y;
        alphaBuf[y * cropW + x] = isFg[gy * cw + gx] ? 255 : 0;
      }
    }
    // 참고: sharp .dilate()로 팽창을 시도했으나 라벨 마스크가 깨져(디자인이 거의
    // 사라짐, 육안 확인) 폐기 — 대신 페더 반경만 살짝 키워(2px) 가장자리를 부드럽게 한다.
    // 팁 실루엣이 타원보다 좁은 큐티클 쪽에 원본 손톱이 살짝 비치는 정도는 실제
    // 손톱의 자연스러운 하이라이트/스마일 라인처럼 보여 허용 가능한 수준으로 판단했다.
    const featheredAlpha = await sharp(alphaBuf, { raw: { width: cropW, height: cropH, channels: 1 } })
      .blur(2)
      .raw().toBuffer();
    const rgba = Buffer.alloc(cropW * cropH * 4);
    for (let i = 0; i < cropW * cropH; i++) {
      rgba[i * 4] = rgb[i * 3]; rgba[i * 4 + 1] = rgb[i * 3 + 1]; rgba[i * 4 + 2] = rgb[i * 3 + 2];
      rgba[i * 4 + 3] = featheredAlpha[i];
    }
    const cropBuf = await sharp(rgba, { raw: { width: cropW, height: cropH, channels: 4 } }).png().toBuffer();
    crops.push(cropBuf);
  }
  return crops;
}

/**
 * 팁 텍스처 5장을 각자의 마스크 위치(cx,cy)·크기(2rx×2ry)·회전(rotationDeg)에 맞춰
 * W×H 캔버스에 올린 "가상 생성본"을 만든다. 마스크 밖 배경색은 무엇이든 상관없다
 * (compositeNails가 maskAlpha>0인 픽셀만 읽으므로).
 */
async function buildGenCanvas(tips: Buffer[], W: number, H: number): Promise<Buffer> {
  const composites: sharp.OverlayOptions[] = [];
  // 타원 마스크보다 살짝 크게(115%) 올린다 — 팁 텍스처 자체의 실루엣이 우리 타원보다
  // 좁으면 가장자리에 원본 손톱이 얇은 테두리로 비쳐 "손톱 안에 또 손톱"처럼 보이는
  // 문제가 있었다(육안 확인). 어차피 최종 경계는 maskAlpha(페더링된 타원)가 정하므로
  // 텍스처를 여유 있게 덮어써도 밖으로 새지 않는다.
  const OVERSCAN = 1.15;
  for (let k = 0; k < NAIL_MASKS.length; k++) {
    const m = NAIL_MASKS[k];
    const tileW = Math.round(m.rx * 2 * OVERSCAN);
    const tileH = Math.round(m.ry * 2 * OVERSCAN);
    const resized = await sharp(tips[k]).resize(tileW, tileH, { fit: 'fill' }).png().toBuffer();
    // rotate()는 회전 후 남는 캔버스를 background로 채운다 — 투명으로 채워 아래서 안전하게 합성.
    const rotated = await sharp(resized)
      .rotate(m.rotationDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    const rMeta = await sharp(rotated).metadata();
    const left = Math.round(m.cx - rMeta.width! / 2);
    const top = Math.round(m.cy - rMeta.height! / 2);
    composites.push({ input: rotated, left, top, blend: 'over' });
  }
  // 캔버스 배경은 완전 투명(alpha=0) — 팁 자체의 진짜 실루엣 알파를 그대로 보존해,
  // 팁이 없는 영역(마스크 타원 안쪽이라도)은 compositeNails에서 원본 손톱으로
  // 자연스럽게 되돌아가게 한다(흰 배경 번짐 방지, 위 autocropTips 주석 참고).
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(composites)
    .raw().toBuffer();
}

/**
 * 마스크 영역 안에서만 텍스처 색상을 원본 위에 합성한다.
 * - 색상/패턴: 팁 텍스처(genRgba)에서 가져온다.
 * - 밝기: 원본 손톱의 손가락별 상대 밝기(그 손톱 영역 평균 대비)를 곱셈 블렌드로 살짝
 *   되살려, 원래 사진의 하이라이트·음영(손톱의 곡률)이 디자인 위에도 비쳐 보이게 한다.
 *   → "스티커를 붙인 느낌"이 아니라 "그 손톱 표면에 실제로 도포된 느낌".
 * - maskAlpha(0~255, 페더링됨)와 genRgba 자체의 알파(팁의 진짜 손톱 실루엣, 흰 배경은
 *   투명) 두 가지를 모두 가중치로 곱해 블렌드한다 — 마스크 타원이 팁의 실제 오벌보다
 *   넓은 부분은 자동으로 원본 손톱 색으로 되돌아가 흰 배경이 번지지 않는다.
 * - 원본 알파 채널은 절대 건드리지 않는다 — 외곽선은 항상 원본과 동일.
 */
function compositeNails(origRgba: Buffer, genRgba: Buffer, maskAlpha: Buffer, W: number, H: number): Buffer {
  const nearestMaskIdx = (x: number, y: number): number => {
    let bestIdx = 0, bestDist = Infinity;
    for (let k = 0; k < NAIL_MASKS.length; k++) {
      const m = NAIL_MASKS[k];
      const dx0 = x - m.cx, dy0 = y - m.cy;
      const rad = (m.rotationDeg * Math.PI) / 180;
      const cos = Math.cos(-rad), sin = Math.sin(-rad);
      const lx = dx0 * cos - dy0 * sin;
      const ly = dx0 * sin + dy0 * cos;
      const dist = (lx / m.rx) ** 2 + (ly / m.ry) ** 2;
      if (dist < bestDist) { bestDist = dist; bestIdx = k; }
    }
    return bestIdx;
  };

  const avgL = new Array(NAIL_MASKS.length).fill(0);
  const avgW = new Array(NAIL_MASKS.length).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = maskAlpha[i];
      if (a === 0) continue;
      const idx = nearestMaskIdx(x, y);
      const p = i * 4;
      const L = luminance(origRgba[p], origRgba[p + 1], origRgba[p + 2]);
      avgL[idx] += L * (a / 255);
      avgW[idx] += a / 255;
    }
  }
  for (let k = 0; k < NAIL_MASKS.length; k++) avgL[k] = avgW[k] > 0 ? avgL[k] / avgW[k] : 128;

  const out = Buffer.from(origRgba); // 알파 포함 원본을 베이스로 복사(알파는 절대 변경 안 함)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const a = maskAlpha[i];
      if (a === 0) continue;
      const idx = nearestMaskIdx(x, y);
      const p = i * 4;
      const genA = genRgba[p + 3]; // 팁 자체의 진짜 실루엣 알파(흰 배경=0)
      if (genA === 0) continue; // 마스크 안이지만 팁 디자인이 없는 곳 — 원본 그대로
      const origL = luminance(origRgba[p], origRgba[p + 1], origRgba[p + 2]);
      // 상한을 1.5→1.25로, 반영 강도(mix)를 0.6→0.35로 낮췄다 — 원본 손톱 사진 자체의
      // 하이라이트(글레어)가 강한 부분에서 옅은 파스텔 디자인이 거의 흰색으로 날아가
      // "워시아웃"되는 문제를 실측으로 확인했다(어두운 색(cand-3 버건디)은 괜찮았지만
      // 밝은 파스텔 색(cand-1/2/4)은 두 차례 재생성에도 계속 씻겨 보임 — 원인이 생성
      // 디자인이 아니라 이 쉐이딩 블렌드였음을 진단). 채도는 그대로 두고 음영만 살짝만.
      const shadeFactor = Math.min(1.25, Math.max(0.75, origL / Math.max(avgL[idx], 1)));
      const mix = 0.35; // 음영 반영 강도
      const w = (a / 255) * (genA / 255); // 마스크 페더 × 팁 실루엣 알파
      for (let c = 0; c < 3; c++) {
        const genV = genRgba[p + c];
        const shaded = Math.min(255, Math.max(0, genV * shadeFactor));
        const designV = genV * (1 - mix) + shaded * mix;
        out[p + c] = Math.round(origRgba[p + c] * (1 - w) + designV * w);
      }
      // out[p+3](알파)는 원본 그대로 유지 — 절대 덮어쓰지 않음
    }
  }
  return out;
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;
  const { data: origRgba } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const maskAlpha = await renderNailMaskAlpha(W, H, 1.2); // 시그마 1.2 ≈ 페더 폭 1.5~3px

  // 커맨드라인 인자로 특정 후보만 재생성 가능(예: 품질 미달로 특정 후보만 다시 만들 때).
  // npx tsx scripts/generate-nail-candidates.mts cand-1 cand-4
  const only = process.argv.slice(2);
  const targets = only.length > 0 ? CANDIDATES.filter((c) => only.includes(c.id)) : CANDIDATES;

  for (const cand of targets) {
    console.log(`\n[${cand.id}] ${cand.label} 생성 중… (공급자: ${process.env.IMAGE_PROVIDER})`);
    const prompt = `${COMMON} ${cand.design}`;
    const outcome = await generateImage([], prompt);
    if (outcome.safetyBlocked) throw new Error('세이프티 차단됨 — 재실행');
    if (!outcome.image) throw new Error('이미지가 반환되지 않음');
    const flatlay = Buffer.from(outcome.image.data, 'base64');

    const tips = await autocropTips(flatlay);
    const genRgba = await buildGenCanvas(tips, W, H);
    const finalRgba = compositeNails(origRgba, genRgba, maskAlpha, W, H);

    const outPath = resolve(OUT_DIR, `${cand.id}.webp`);
    await sharp(finalRgba, { raw: { width: W, height: H, channels: 4 } })
      .webp({ quality: 92, alphaQuality: 100 })
      .toFile(outPath);
    console.log(`  저장 완료: ${outPath}`);
  }
  console.log('\n모든 후보 생성 완료. ref/nail-candidates/cand-1..4.webp를 육안으로 확인할 것.');
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
