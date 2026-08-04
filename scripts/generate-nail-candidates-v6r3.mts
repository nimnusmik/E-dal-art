/**
 * 히어로 네일아트 "6r3" 라운드(마스크 지오메트리 3차 보정) — 컨트롤러가
 * v6r2-2-fingertip-zoom.png 확대 검수에서 재기각한 결함을 고친다.
 *
 *   6r2에서 도입한 순환 라플라시안 통제점 스무딩(smoothControlPoints,
 *   factor=0.35 x2회)이 다각형을 중심 쪽으로 수축시켰다(라플라시안 스무딩의
 *   잘 알려진 성질). 특히 액센트 손톱(중지·약지)에서 딥 바이올렛 영역이
 *   손톱의 길쭉한 타원이 아니라 둥근 원(blob)이 돼 버렸고, 그만큼 확보했던
 *   커버리지(첨단·측벽)도 다시 줄어 맨손톱 밴드가 우측·큐티클 쪽에 재발했다.
 *
 * 조치 — nail-masks.mts의 smoothControlPoints를 Taubin 스무딩
 * (taubinSmoothControlPoints, λ=0.5/μ=-0.53, 6회 반복)으로 교체했다.
 * Taubin 스무딩은 라플라시안 저역통과 1단계 뒤 반대 방향(바깥쪽)으로 더 크게
 * 이동하는 2단계를 더해, 노이즈(고주파)는 지우되 전체 둘레/면적(저주파)은
 * 원래대로 복원하는 "shrinkage-free" 스무딩이다 — 실제 검증: 통제점 다각형
 * 면적이 원본 트레이싱 다각형과 거의 같게 유지됨을 확인(예: 중지 aspect
 * ry/rx ≈ 1.22, 원본 RAW_POINTS 바운딩박스 비율 ≈ 1.25로 거의 일치).
 *
 * 그 외(Catmull-Rom 조밀화, 첨단 1.08x/큐티클 1.02x 방향성 확장, 첨단
 * 2.0px/큐티클 1.5px 방향성 페더, 텍스처/디자인/작곡 규칙)는
 * generate-nail-candidates-v6r2.mts와 완전히 동일하게 재사용한다 — 바뀐
 * 것은 오직 nail-masks.mts의 통제점 스무딩 알고리즘뿐이다.
 *
 *   npx tsx scripts/generate-nail-candidates-v6r3.mts            (2개 후보 + 콘택트시트)
 *   npx tsx scripts/generate-nail-candidates-v6r3.mts v6r3-1     (특정 후보만)
 */
import { mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NAIL_MASKS, renderNailFeatherAlpha, type NailMask } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const TEX_DIR = '/tmp/nailwork/v6-glaze-textures';
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');

interface Candidate {
  id: string;
  label: string;
  basePath: string;
  accentPath: string;
  accentFingers: number[]; // NAIL_MASKS 인덱스(0=엄지..4=소지)
}

const CANDIDATES: Candidate[] = [
  {
    id: 'v6r3-1',
    label: '천사날개 글레이즈(6r3 마스크 보정) — 오로라 펄 베이스 + 은장 깃털 라인 메아리 + 딥 로즈와인 액센트(중지·약지, 날개-하트 포컬)',
    basePath: resolve(TEX_DIR, 'v6-1-base.jpg'),
    accentPath: resolve(TEX_DIR, 'v6-1-accent.jpg'),
    accentFingers: [2, 3],
  },
  {
    id: 'v6r3-2',
    label: '별똥별 글레이즈(6r3 마스크 보정) — 오로라 펄 베이스 + 은장 유성 라인 메아리 + 딥 미드나잇 라벤더 액센트(중지·약지, 별똥별 포컬)',
    basePath: resolve(TEX_DIR, 'v6-2-base.jpg'),
    accentPath: resolve(TEX_DIR, 'v6-2-accent.jpg'),
    accentFingers: [2, 3],
  },
];

const SAMPLE_SPOTS: { cxFrac: number; cyFrac: number; sizeFrac: number }[] = [
  { cxFrac: 0.46, cyFrac: 0.42, sizeFrac: 0.4 }, // 엄지 — base(중앙 라인 밴드)
  { cxFrac: 0.58, cyFrac: 0.4, sizeFrac: 0.4 }, // 검지 — base(중앙 라인 밴드)
  { cxFrac: 0.5, cyFrac: 0.5, sizeFrac: 0.62 }, // 중지 — accent(포컬 중앙)
  { cxFrac: 0.5, cyFrac: 0.5, sizeFrac: 0.66 }, // 약지 — accent(포컬 중앙, 살짝 넓게)
  { cxFrac: 0.44, cyFrac: 0.58, sizeFrac: 0.4 }, // 소지 — base(중앙 라인 밴드)
];

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

async function usableInteriorRect(texPath: string): Promise<{ left: number; top: number; width: number; height: number }> {
  const { data, info } = await sharp(texPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const isBg = (i: number): boolean => {
    const p = i * 4;
    const r = data[p], g = data[p + 1], b = data[p + 2];
    return (r > 235 && g > 235 && b > 235) || (r < 12 && g < 12 && b < 12);
  };
  const bg = new Uint8Array(W * H);
  const stack: number[] = [];
  const seed = (x: number, y: number) => {
    const idx = y * W + x;
    if (isBg(idx) && !bg[idx]) { bg[idx] = 1; stack.push(idx); }
  };
  for (let x = 0; x < W; x++) { seed(x, 0); seed(x, H - 1); }
  for (let y = 0; y < H; y++) { seed(0, y); seed(W - 1, y); }
  while (stack.length > 0) {
    const idx = stack.pop()!;
    const y = Math.floor(idx / W), x = idx - y * W;
    for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue;
      const n = ny * W + nx;
      if (!bg[n] && isBg(n)) { bg[n] = 1; stack.push(n); }
    }
  }
  let left = W, right = -1, top = H, bottom = -1;
  let sumX = 0, sumY = 0, count = 0;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!bg[y * W + x]) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        sumX += x; sumY += y; count++;
      }
    }
  }
  if (right < left || bottom < top) return { left: 0, top: 0, width: W, height: H };

  const prefix = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += bg[y * W + x];
      prefix[(y + 1) * (W + 1) + (x + 1)] = prefix[y * (W + 1) + (x + 1)] + rowSum;
    }
  }
  const bgCount = (l: number, t: number, r: number, b: number): number =>
    prefix[b * (W + 1) + r] - prefix[t * (W + 1) + r] - prefix[b * (W + 1) + l] + prefix[t * (W + 1) + l];

  const ccx = Math.round(sumX / count), ccy = Math.round(sumY / count);
  const maxHalf = Math.min(ccx, W - ccx, ccy, H - ccy);
  let lo = 0, hi = maxHalf;
  const fits = (half: number): boolean => {
    const l = ccx - half, t = ccy - half, r = ccx + half, b = ccy + half;
    if (l < 0 || t < 0 || r > W || b > H) return false;
    const area = (2 * half) * (2 * half);
    return bgCount(l, t, r, b) <= area * 0.005;
  };
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (fits(mid)) lo = mid; else hi = mid - 1;
  }
  const half = Math.max(4, Math.round(lo * 0.92));
  return { left: ccx - half, top: ccy - half, width: half * 2, height: half * 2 };
}

async function sampleTextureTile(texPath: string, interior: { left: number; top: number; width: number; height: number }, spot: { cxFrac: number; cyFrac: number; sizeFrac: number }, m: NailMask): Promise<Buffer> {
  const side = Math.round(Math.min(interior.width, interior.height) * spot.sizeFrac);
  const cx = interior.left + Math.round(interior.width * spot.cxFrac);
  const cy = interior.top + Math.round(interior.height * spot.cyFrac);
  const left = Math.max(interior.left, Math.min(interior.left + interior.width - side, cx - Math.round(side / 2)));
  const top = Math.max(interior.top, Math.min(interior.top + interior.height - side, cy - Math.round(side / 2)));

  const crop = await sharp(texPath).extract({ left, top, width: side, height: side }).png().toBuffer();

  const OVERSCAN = 1.15;
  const tileW = Math.round(m.rx * 2 * OVERSCAN);
  const tileH = Math.round(m.ry * 2 * OVERSCAN);
  const resized = await sharp(crop).resize(tileW, tileH, { fit: 'fill' }).png().toBuffer();
  return sharp(resized).rotate(m.rotationDeg, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha().png().toBuffer();
}

async function placeTileOnCanvas(tile: Buffer, m: NailMask, W: number, H: number): Promise<Buffer> {
  const rMeta = await sharp(tile).metadata();
  const left = Math.round(m.cx - rMeta.width! / 2);
  const top = Math.round(m.cy - rMeta.height! / 2);
  return sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: tile, left, top, blend: 'over' }])
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
  const highlightThresh = avgL * 1.2;

  for (let i = 0; i < W * H; i++) {
    const a = maskAlpha[i];
    if (a === 0) continue;
    const p = i * 4;
    const genA = genRgba[p + 3];
    if (genA === 0) continue;
    const origL = luminance(canvas[p], canvas[p + 1], canvas[p + 2]);
    const shadeFactor = Math.min(1.3, Math.max(0.7, origL / Math.max(avgL, 1)));
    const mixShade = 0.5;
    const w = (a / 255) * (genA / 255);

    const highlightBoost = origL > highlightThresh
      ? 0.22 * Math.min(1, (origL - highlightThresh) / Math.max(1, 255 - highlightThresh))
      : 0;

    for (let c = 0; c < 3; c++) {
      const genV = genRgba[p + c];
      const shaded = Math.min(255, Math.max(0, genV * shadeFactor));
      let designV = genV * (1 - mixShade) + shaded * mixShade;
      if (highlightBoost > 0) designV = designV + (255 - designV) * highlightBoost;
      canvas[p + c] = Math.round(canvas[p + c] * (1 - w) + designV * w);
    }
  }
}

async function buildCandidate(cand: Candidate, W: number, H: number, origRgba: Buffer, maskAlphas: Buffer[]): Promise<void> {
  console.log(`\n[${cand.id}] ${cand.label} — 텍스처 매핑 시작`);
  const canvas = Buffer.from(origRgba);

  const baseInterior = await usableInteriorRect(cand.basePath);
  const accentInterior = await usableInteriorRect(cand.accentPath);

  for (let i = 0; i < NAIL_MASKS.length; i++) {
    const m = NAIL_MASKS[i];
    const isAccent = cand.accentFingers.includes(i);
    const texPath = isAccent ? cand.accentPath : cand.basePath;
    const interior = isAccent ? accentInterior : baseInterior;
    const spot = SAMPLE_SPOTS[i];
    process.stdout.write(`  - ${m.name}${isAccent ? '(액센트)' : ''} 매핑 중… `);
    const tile = await sampleTextureTile(texPath, interior, spot, m);
    const genRgba = await placeTileOnCanvas(tile, m, W, H);
    compositeOneNail(canvas, genRgba, maskAlphas[i], W, H);
    console.log('완료');
  }

  const outPath = resolve(OUT_DIR, `${cand.id}.webp`);
  await sharp(canvas, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 92, alphaQuality: 100 }).toFile(outPath);
  console.log(`  저장 완료: ${outPath}`);
}

async function buildContactSheets(W: number, H: number): Promise<void> {
  const labels = ['맨손', ...CANDIDATES.map((c) => c.id)];
  const paths = [SRC, ...CANDIDATES.map((c) => resolve(OUT_DIR, `${c.id}.webp`))];

  const fullLabelH = 48;
  const fullCanvas = sharp({ create: { width: W * paths.length, height: H + fullLabelH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } });
  const fullComposites = [];
  for (let i = 0; i < paths.length; i++) {
    const buf = await sharp(paths[i]).png().toBuffer();
    fullComposites.push({ input: buf, left: i * W, top: fullLabelH });
    const svg = `<svg width="${W}" height="${fullLabelH}"><rect width="100%" height="100%" fill="#141414"/><text x="16" y="32" font-size="28" fill="white" font-family="sans-serif">${labels[i]}</text></svg>`;
    fullComposites.push({ input: Buffer.from(svg), left: i * W, top: 0 });
  }
  await fullCanvas.composite(fullComposites).png().toFile(resolve(OUT_DIR, 'contact-sheet-v6r3.png'));
  console.log(`전체 사이즈 콘택트시트 저장: ${resolve(OUT_DIR, 'contact-sheet-v6r3.png')}`);

  const smallW = 500;
  const smallH = Math.round((H / W) * smallW);
  const smallLabelH = 28;
  const smallComposites = [];
  for (let i = 0; i < paths.length; i++) {
    const buf = await sharp(paths[i]).resize(smallW, smallH).png().toBuffer();
    smallComposites.push({ input: buf, left: i * smallW, top: smallLabelH });
    const svg = `<svg width="${smallW}" height="${smallLabelH}"><rect width="100%" height="100%" fill="#141414"/><text x="8" y="20" font-size="16" fill="white" font-family="sans-serif">${labels[i]}</text></svg>`;
    smallComposites.push({ input: Buffer.from(svg), left: i * smallW, top: 0 });
  }
  await sharp({ create: { width: smallW * paths.length, height: smallH + smallLabelH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } })
    .composite(smallComposites)
    .png()
    .toFile(resolve(OUT_DIR, 'contact-sheet-v6r3-small.png'));
  console.log(`소형 사이즈 콘택트시트 저장: ${resolve(OUT_DIR, 'contact-sheet-v6r3-small.png')}`);
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;
  const { data: origRgba } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  // 손톱별 알파 마스크 — 6r2와 동일하게 renderNailFeatherAlpha로 방향성 페더를
  // 적용한다(첨단 2.0px, 큐티클 1.5px). 바뀐 것은 nail-masks.mts 내부의 통제점
  // 스무딩(Taubin)뿐이므로 NAIL_MASKS.points 자체가 이미 6r3 지오메트리다.
  const TIP_SIGMA = 2.0;
  const CUTICLE_SIGMA = 1.5;
  const maskAlphas: Buffer[] = [];
  for (let i = 0; i < NAIL_MASKS.length; i++) {
    const m = NAIL_MASKS[i];
    const data = await renderNailFeatherAlpha(m, W, H, TIP_SIGMA, CUTICLE_SIGMA);
    maskAlphas.push(data);
  }

  const args = process.argv.slice(2);
  const only = args.filter((a) => !a.startsWith('--'));
  const targets = only.length > 0 ? CANDIDATES.filter((c) => only.includes(c.id)) : CANDIDATES;
  if (targets.length === 0) throw new Error(`알 수 없는 후보 id: ${only.join(', ')}`);

  for (const cand of targets) {
    await buildCandidate(cand, W, H, origRgba, maskAlphas);
  }

  if (only.length === 0) {
    await buildContactSheets(W, H);
  }

  console.log('\n모든 후보(6r3) 생성 완료. ref/nail-candidates/v6r3-*.webp와 contact-sheet-v6r3*.png를 육안으로 확인할 것.');
}

const isMainModule = process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`;
if (isMainModule) {
  run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
}
