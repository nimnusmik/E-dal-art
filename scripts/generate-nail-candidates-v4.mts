/**
 * 히어로 네일아트 후보 4차 라운드 — 2단계: 1단계(scripts/generate-nail-texture-v4.mts)에서
 * 생성한 "디자인 시트/플랫 텍스처"를 손톱 5개 마스크에 결정론적으로(순수 코드로)
 * 샘플링·회전·재조명해 합성한다.
 *
 *   npx tsx scripts/generate-nail-candidates-v4.mts          (3개 후보 + 콘택트시트)
 *   npx tsx scripts/generate-nail-candidates-v4.mts v4-2     (특정 후보만, 시트는 생략)
 *
 * 2~3차 라운드는 "아트 생성"과 "손톱 배치"가 한 몸이었다(손톱 하나짜리 작은 크롭을
 * 모델에게 직접 그리게 함) — 그 결과 모델이 블록 채색으로 후퇴했다(v3 액센트
 * 손톱의 각진 대각선 경계, 요청한 크롬 세선 라인아트 미구현, v3-1 검지의 검은
 * 아크 아티팩트). 이번 라운드는 두 단계를 분리한다:
 *   - 아트는 모델이 잘하는 태스크(손톱 모양과 무관한 대형 재질 스와치 사진)로
 *     생성했으므로 하드 블록 경계나 컷아웃 이음새가 원천적으로 발생할 수 없다 —
 *     배치·마스킹·재조명이 전부 코드이기 때문이다. 아래에서 실제로 이를 검증한다.
 *   - 손톱별로 텍스처의 서로 다른 영역을 손가락 축 방향으로 회전·크롭해
 *     "그 손톱 위에 흐르는" 것처럼 보이게 하고, 원본 사진의 명암(하이라이트·
 *     큐티클 그림자)을 유지해 3D 곡률을 살린다.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { NAIL_MASKS, type NailMask } from './nail-masks.mts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const TEX_DIR = '/tmp/nailwork/v4-textures';
const OUT_DIR = resolve(ROOT, 'ref/nail-candidates');

interface Candidate {
  id: string;
  label: string;
  basePath: string;
  accentPath: string;
  /** NAIL_MASKS 인덱스(0=엄지,1=검지,2=중지,3=약지,4=소지) 중 액센트를 받을 손톱 */
  accentFingers: number[];
}

const CANDIDATES: Candidate[] = [
  {
    id: 'v4-1',
    label: '오로라 펄 크롬 + 딥 자수정 액센트(중지·약지) + 실버 포일 라인아트',
    basePath: resolve(TEX_DIR, 'v4-1-base.jpg'),
    accentPath: resolve(TEX_DIR, 'v4-1-accent.jpg'),
    accentFingers: [2, 3],
  },
  {
    id: 'v4-2',
    label: '오로라 펄 크롬 + 딥 버건디 액센트(중지·약지) + 골드 포일 라인아트',
    basePath: resolve(TEX_DIR, 'v4-2-base.jpg'),
    accentPath: resolve(TEX_DIR, 'v4-2-accent.jpg'),
    accentFingers: [2, 3],
  },
  {
    id: 'v4-3',
    label: '밀키 펄 크롬 + 딥 에메랄드 액센트(엄지·소지) + 골드 마이크로 펄 라인아트',
    basePath: resolve(TEX_DIR, 'v4-3-base.jpg'),
    accentPath: resolve(TEX_DIR, 'v4-3-accent.jpg'),
    accentFingers: [0, 4],
  },
];

/**
 * 손톱마다 텍스처 패널 안에서 서로 다른 영역을 샘플링하도록 하는 대각선 스캔
 * 좌표(분수 좌표, 0~1). 손가락 축을 따라 디자인이 "흐르는" 느낌을 주기 위해
 * 엄지→소지 순서로 패널 대각선을 훑는다. sizeFrac은 크롭 정사각형의 한 변이
 * 패널 전체 대비 차지하는 비율 — 너무 작으면 단색만 잘려 라인아트가 안 보이고,
 * 너무 크면 배경(흰/검정 프레임)까지 걸릴 수 있어 0.38~0.5 사이로 둔다.
 */
const SAMPLE_SPOTS: { cxFrac: number; cyFrac: number; sizeFrac: number }[] = [
  { cxFrac: 0.28, cyFrac: 0.3, sizeFrac: 0.46 }, // 엄지
  { cxFrac: 0.42, cyFrac: 0.4, sizeFrac: 0.4 }, // 검지
  { cxFrac: 0.55, cyFrac: 0.52, sizeFrac: 0.4 }, // 중지
  { cxFrac: 0.66, cyFrac: 0.62, sizeFrac: 0.42 }, // 약지
  { cxFrac: 0.78, cyFrac: 0.72, sizeFrac: 0.46 }, // 소지
];

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * 텍스처 패널에서 실제 재질(디자인)이 채워진 안쪽 사각형을 찾는다. 1단계 생성물이
 * "카드/스와치" 프레이밍으로 나오면 모서리에 흰/검정 배경이 남을 수 있으므로,
 * 네 변에서 흰(>235)·검정(<12) 배경을 BFS로 제거하고 남은 전경의 바운딩박스를
 * 구한 뒤 안쪽으로 5% 추가 마진을 준다. 완전 풀블리드 패널은 사실상 전체 프레임이
 * 그대로 반환된다.
 */
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
  if (right < left || bottom < top) return { left: 0, top: 0, width: W, height: H }; // 전경 없음 → 전체 사용

  // bbox만으로는 부족하다 — 1단계 생성물이 대각선으로 회전된 카드/팁 프레이밍으로
  // 나오면(예: v4-1-base) bbox 네 귀퉁이 안쪽에 배경(검정/흰색) 쐐기가 남아있을 수
  // 있다(예: 엄지 마스크가 그 쐐기를 샘플링해 손톱에 하드 블록 아티팩트가 생긴 버그
  // — 실측으로 발견, 2026-08-04). bbox 대신 "완전히 전경으로만 채워진, 전경
  // 무게중심을 중심으로 한 최대 정사각형"을 접두합(prefix sum)으로 정확히 찾아
  // 그 정사각형만 샘플링 대상으로 삼는다 — 풀블리드 패널(액센트 패널들)에서는
  // 이 정사각형이 사실상 bbox 전체에 가깝게 나온다.
  const prefix = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let rowSum = 0;
    for (let x = 0; x < W; x++) {
      rowSum += bg[y * W + x];
      prefix[(y + 1) * (W + 1) + (x + 1)] = prefix[y * (W + 1) + (x + 1)] + rowSum;
    }
  }
  const bgCount = (l: number, t: number, r: number, b: number): number => {
    // 반열린 사각형 [l,r) x [t,b)
    return prefix[b * (W + 1) + r] - prefix[t * (W + 1) + r] - prefix[b * (W + 1) + l] + prefix[t * (W + 1) + l];
  };

  const ccx = Math.round(sumX / count), ccy = Math.round(sumY / count);
  const maxHalf = Math.min(ccx, W - ccx, ccy, H - ccy);
  let lo = 0, hi = maxHalf;
  const fits = (half: number): boolean => {
    const l = ccx - half, t = ccy - half, r = ccx + half, b = ccy + half;
    if (l < 0 || t < 0 || r > W || b > H) return false;
    const area = (2 * half) * (2 * half);
    return bgCount(l, t, r, b) <= area * 0.005; // 안티에일리어싱 노이즈 허용 오차
  };
  while (lo < hi) {
    const mid = Math.ceil((lo + hi + 1) / 2);
    if (fits(mid)) lo = mid; else hi = mid - 1;
  }
  const half = Math.max(4, Math.round(lo * 0.92)); // 추가 5~10% 안전 마진
  return { left: ccx - half, top: ccy - half, width: half * 2, height: half * 2 };
}

/**
 * 텍스처 패널에서 손톱 하나에 쓸 사각 타일을 잘라 손톱의 미회전 바운딩박스
 * (rx*2 x ry*2, OVERSCAN 포함) 크기로 리사이즈한다 — v2/v3의 placeTipOnCanvas와
 * 동일한 "리사이즈 후 회전" 구조를 재사용해, 회전된 손톱 마스크(타원)가 회전된
 * 텍스처 타일에 내접하도록 보장한다(마스크 바깥 투명 모서리가 노출되지 않음).
 */
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
  // 손톱 종횡비에 맞춰 텍스처를 채워 늘리되(fit: 'fill'), 정사각 크롭이라 왜곡은
  // 손톱마다 rx:ry 비가 1에 가까워 미미하다.
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

/**
 * 재조명(relighting) — 브리프 3단계. 새 디자인 색상 위에 원본 손톱 사진의 명암을
 * 되살린다: (1) 기본 셰이딩 — 원본 대비 밝기 비율(shadeFactor)을 디자인 색에
 * 곱해 손톱의 굴곡·큐티클 그림자를 유지, (2) 하이라이트 보존 — 원본에서 평균보다
 * 훨씬 밝은 영역(진짜 글로시 스페큘러 하이라이트)은 스크린 블렌드로 한 번 더
 * 밝혀 광택이 디자인 위에도 그대로 읽히게 한다.
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

  // 전체 사이즈 콘택트시트: 원본 해상도 그대로 가로로 나열
  const fullLabelH = 48;
  const fullCanvas = sharp({ create: { width: W * paths.length, height: H + fullLabelH, channels: 4, background: { r: 20, g: 20, b: 20, alpha: 1 } } });
  const fullComposites = [];
  for (let i = 0; i < paths.length; i++) {
    const buf = await sharp(paths[i]).png().toBuffer();
    fullComposites.push({ input: buf, left: i * W, top: fullLabelH });
    const svg = `<svg width="${W}" height="${fullLabelH}"><rect width="100%" height="100%" fill="#141414"/><text x="16" y="32" font-size="28" fill="white" font-family="sans-serif">${labels[i]}</text></svg>`;
    fullComposites.push({ input: Buffer.from(svg), left: i * W, top: 0 });
  }
  await fullCanvas.composite(fullComposites).png().toFile(resolve(OUT_DIR, 'contact-sheet-v4.png'));
  console.log(`전체 사이즈 콘택트시트 저장: ${resolve(OUT_DIR, 'contact-sheet-v4.png')}`);

  // 소형 사이즈 콘택트시트: 히어로 실제 렌더 스케일(손 폭 500px)로 축소해 나열
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
    .toFile(resolve(OUT_DIR, 'contact-sheet-v4-small.png'));
  console.log(`소형 사이즈 콘택트시트 저장: ${resolve(OUT_DIR, 'contact-sheet-v4-small.png')}`);
}

async function run() {
  mkdirSync(OUT_DIR, { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!;
  const { data: origRgba } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

  const maskAlphas: Buffer[] = [];
  for (const m of NAIL_MASKS) {
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="black"/>`;
    svg += `<g transform="rotate(${m.rotationDeg} ${m.cx} ${m.cy})"><ellipse cx="${m.cx}" cy="${m.cy}" rx="${m.rx}" ry="${m.ry}" fill="white"/></g></svg>`;
    const { data } = await sharp(Buffer.from(svg)).blur(1.2).greyscale().raw().toBuffer({ resolveWithObject: true });
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

  console.log('\n모든 후보 생성 완료. ref/nail-candidates/v4-*.webp와 contact-sheet-v4*.png를 육안으로 확인할 것.');
}

const isMainModule = process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`;
if (isMainModule) {
  run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
}
