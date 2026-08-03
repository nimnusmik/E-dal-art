/**
 * 히어로 "변신 후 손" 네일아트 후보 3차 라운드 — v2-1(오로라 파스텔)과
 * v2-2(버건디 글레이즈)의 장점을 한 세트 안에서 결합한다.
 *   npx tsx scripts/generate-nail-candidates-v3.mts        (3개 후보 전부)
 *   npx tsx scripts/generate-nail-candidates-v3.mts v3-2   (특정 후보만)
 *   npx tsx scripts/generate-nail-candidates-v3.mts v3-1 --fingers=중지,약지
 *
 * 배경(사용자 리뷰, 2026-08-03): v2-1은 예쁘지만 히어로에서 손톱이 실제로는
 * 세로 40px 안팎으로만 렌더링되는 축소 상황에서 대비가 약해 "변화가 거의 안
 * 보인다"는 위험이 있었고, 중지의 대각선 스트라이프는 오로라가 아니라
 * 테이프처럼 읽혔다. v2-2는 축소해도 대비가 또렷했지만 검지·약지가 완전 단색
 * 블록이라 "그림"이 아니라 "페인트칠"처럼 보였고 흰색 대각 스윕이 조악했다.
 *
 * 이번 라운드 목표: v2-1의 오로라/글레이즈 베이스 언어는 유지하되, (1) 1~2개
 * 액센트 손톱을 뚜렷이 더 짙고 채도 높은 크롬 톤으로 바꾸고, (2) 크롬/포일
 * 세선 라인아트를 5개 손톱 전부에 추가해 축소 시에도 형태가 살아남을 만큼
 * 명도 대비를 준다. 균일한 대각선 스트라이프(테이프처럼 보임), 완전 무지 손톱,
 * 하드 페이싯(보석 컷) 패턴은 모두 금지.
 *
 * 파이프라인은 2차 라운드(scripts/generate-nail-candidates-v2.mts, 커밋
 * 86a2881)와 완전히 동일하게 재사용한다 — 손톱마다 그 손가락의 실제 사진
 * 크롭을 참조로 개별 생성 → 재측정된 타원 마스크에 리사이즈·회전 배치 →
 * 원본 위에만 페더링 블렌드. 이 구조 자체는 이미 정렬/워시아웃 문제를
 * 해결했으므로 바꾸지 않는다. 바뀐 것은 오직 CANDIDATES의 디자인 프롬프트뿐.
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
  "Banned clichés — never include: 3D food charms (donut, candy, cake, fruit), ribbon bows, dangling rings or jewelry charms, rainbow sprinkles, cartoon characters, oversized 3D parts taller than the nail's curve, text, watermark, logos, hard faceted/gem-cut geometric patterns.",
  'Any decoration stays low-profile and refined (micro pearls, fine foil lines, thin hand-painted strokes, tiny flat studs) — small flat metal stars/moons resting on the surface are allowed.',
].join(' ');

/** 대각 스트라이프(테이프처럼 보임) 금지 + 크롬 포일 라인의 대비 요구를 공통으로 강제 */
const CONTRAST_LINES = [
  'CRITICAL contrast requirement: the fine foil linework must be an actual reflective metallic foil strip (mirror-bright silver or gold chrome), hairline thin (about 1mm), with real luminance contrast against the base color — not a same-tone painted line, not faint, not washed out.',
  'CRITICAL — avoid a common failure: do NOT paint a uniform diagonal stripe or repeating parallel diagonal bands across the whole nail (this reads as striped tape, not aurora or line-art). The foil line must be a single deliberate accent shape — a thin arc, a cuticle-hugging curve, or two short hairline strokes — occupying a small fraction of the nail, with plain glazed base everywhere else.',
  'CRITICAL — no nail may be left completely flat, plain, or undecorated: every one of the 5 nails must show at least the glazed base color plus its fine foil linework.',
].join(' ');

interface Candidate {
  id: string;
  label: string;
  /** 비-액센트 손톱: 오로라 파스텔 베이스 + 포일 라인아트 */
  baseDesign: string;
  /** 액센트 손톱: 짙고 채도 높은 크롬 톤으로 교체(같은 포일 라인 언어로 세트 통일감 유지) */
  accentDesign: string;
  /** NAIL_MASKS 인덱스(0=엄지,1=검지,2=중지,3=약지,4=소지) 중 액센트를 받을 손톱 */
  accentFingers: number[];
}

const CANDIDATES: Candidate[] = [
  {
    id: 'v3-1',
    label: '오로라 크롬 + 딥 자수정 액센트(중지·약지) + 실버 포일 아크',
    baseDesign:
      "This month's signature design — glazed aurora chrome nail art. Soft pearlescent aurora film gradient shifting between lilac, ice blue, and champagne pink under studio light, painted as one smooth continuous color-shifting sheen with a glossy glass-like highlight — NO hard geometric edges or flat color blocks. " +
      'Add one crisp hairline-thin mirror-silver foil arc curving along the cuticle line, about one-third of the nail width, resting on top of the glossy aurora sheen.',
    accentDesign:
      "This month's signature design — a deep, richly saturated amethyst-violet chrome gel, ONE single smooth continuous deep color across the entire nail (like a mirror-chrome lacquer, not two-tone, not faceted), high-shine mirror-glossy top coat. " +
      'Add the exact same crisp hairline-thin mirror-silver foil arc along the cuticle line as the other nails in this set, so the accent nail visually rhymes with the aurora nails despite the deeper base color.',
    accentFingers: [2, 3], // 중지, 약지
  },
  {
    id: 'v3-2',
    label: '오로라 크롬 + 딥 버건디 액센트(중지·약지) + 골드 포일 아크',
    baseDesign:
      "This month's signature design — glazed aurora chrome nail art. Soft pearlescent aurora film gradient shifting between lilac, ice blue, and champagne pink under studio light, painted as one smooth continuous color-shifting sheen with a glossy glass-like highlight — NO hard geometric edges or flat color blocks. " +
      'Add one crisp hairline-thin warm gold foil arc curving along the cuticle line, about one-third of the nail width, resting on top of the glossy aurora sheen.',
    accentDesign:
      "This month's signature design — a deep, richly saturated burgundy-wine chrome gel, ONE single smooth continuous deep color across the entire nail (like a mirror-chrome lacquer, not two-tone, not faceted), high-shine mirror-glossy top coat. " +
      'Add the exact same crisp hairline-thin warm gold foil arc along the cuticle line as the other nails in this set, so the accent nail visually rhymes with the aurora nails despite the deeper base color.',
    accentFingers: [2, 3], // 중지, 약지
  },
  {
    id: 'v3-3',
    label: '오로라 크롬 + 딥 에메랄드 액센트(엄지·소지) + 실버 이중 라인',
    baseDesign:
      "This month's signature design — glazed aurora chrome nail art. Soft pearlescent aurora film gradient shifting between lilac, ice blue, and champagne pink under studio light, painted as one smooth continuous color-shifting sheen with a glossy glass-like highlight — NO hard geometric edges or flat color blocks. " +
      'The aurora colors must blend as ONE soft continuous painterly wash across the whole nail (like watercolor bleeding together) — absolutely NOT as 2 or more distinct parallel stripes or bands of solid color running across or down the nail; if you cannot blend seamlessly, default to a single dominant pastel hue (pick just lilac OR ice blue OR champagne) rather than showing visible stripe bands. ' +
      'The pastel color must be clearly, visibly saturated and pigmented — like a real opaque pastel gel polish, not a faint sheer wash or a barely-there tint; a person glancing quickly must immediately see this nail is polished a color, not almost-bare.' +
      'Add two short crisp hairline-thin mirror-silver foil strokes near the cuticle, close together like a delicate double line accent (not a stripe across the whole nail, not parallel bands repeating down the nail), resting on top of the glossy aurora sheen.',
    accentDesign:
      "This month's signature design — a deep, richly saturated emerald-teal chrome gel, ONE single smooth continuous deep color across the entire nail (like a mirror-chrome lacquer, not two-tone, not faceted), high-shine mirror-glossy top coat. " +
      'Add the exact same two short crisp hairline-thin mirror-silver foil strokes near the cuticle as the other nails in this set, so the accent nail visually rhymes with the aurora nails despite the deeper base color.',
    accentFingers: [0, 4], // 엄지, 소지
  },
];

/**
 * 흰 배경 위 손톱 팁 "단일 객체" 컷아웃을 자동 크롭한다 — v2에서 검증된 방식
 * 그대로 재사용(테두리에서 시작하는 BFS로 "진짜 배경"만 표시 → 옅은 색
 * 디자인에 구멍이 뚫리는 버그 방지).
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

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function placeTipOnCanvas(tip: Buffer, m: NailMask, W: number, H: number): Promise<Buffer> {
  const OVERSCAN = 1.15;
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
  }
}

export async function generateOneNailTip(m: NailMask, cand: Candidate, isAccent: boolean, W: number, H: number): Promise<Buffer> {
  const crop = nailCropRect(m, W, H);
  const cropBuf = await sharp(SRC).extract(crop).flatten({ background: '#ffffff' }).png().toBuffer();
  const upscale = 900;
  const scale = upscale / Math.max(crop.width, crop.height);
  const refBuf = await sharp(cropBuf).resize(Math.round(crop.width * scale), Math.round(crop.height * scale)).png().toBuffer();

  const designLine = isAccent ? cand.accentDesign : cand.baseDesign;
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
    `IMPORTANT — the reference photo of the bare nail may show a diagonal specular glare streak from studio lighting on the natural nail surface. Do NOT reproduce that glare streak as a hard color boundary or a second lighter shade cutting diagonally across the nail — that specific failure (a pale diagonal band splitting the nail into two visibly different-colored regions) is unacceptable. The finished polish color must be uniform and continuous over the ENTIRE nail with at most a small soft round glossy highlight dot, never a diagonal stripe. ` +
    `${CONTRAST_LINES} ` +
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
  const canvas = Buffer.from(origRgba);

  const outPath = resolve(OUT_DIR, `${cand.id}.webp`);
  if (onlyFingerIdx) {
    try {
      const { data: prevRgba } = await sharp(outPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < NAIL_MASKS.length; i++) {
        if (onlyFingerIdx.includes(i)) continue;
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

  const sharpMod = (await import('sharp')).default;
  const maskAlphas: Buffer[] = [];
  for (const m of NAIL_MASKS) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="black"/>`;
    svg += `<g transform="rotate(${m.rotationDeg} ${m.cx} ${m.cy})"><ellipse cx="${m.cx}" cy="${m.cy}" rx="${m.rx}" ry="${m.ry}" fill="white"/></g></svg>`;
    const { data } = await sharpMod(Buffer.from(svg)).blur(1.2).greyscale().raw().toBuffer({ resolveWithObject: true });
    maskAlphas.push(data);
  }

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
  console.log('\n모든 후보 생성 완료. ref/nail-candidates/v3-*.webp를 육안으로 확인할 것.');
}
const isMainModule = process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`;
if (isMainModule) {
  run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
}
