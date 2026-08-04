/**
 * public/hero/hand.webp(1000×1796, 손등 뷰) 안의 손톱 5개 위치를 고정 좌표로
 * 하드코딩한다. hand.webp 픽셀은 앞으로도 절대 바뀌지 않으므로("손 전체 재생성"
 * 대신 "손톱 영역만 합성" 방식, 2026-08-03 결정) 이 좌표를 한 번만 눈으로
 * 확인해 고정하면 계속 재사용할 수 있다.
 *
 * 2026-08-04(6차 라운드) 재작업 배경: 5차까지 쓰던 회전 타원(ellipse) 근사가
 * 사용자 확대 검수에서 기각됐다 — 엄지·검지·소지에서 타원이 실제 손톱판보다
 * 크고 중심이 어긋나 큐티클 라인을 무시하고 손끝 피부까지 덮었다("손톱 위에
 * 붙인 스티커"처럼 보임). 이번엔 각 손톱을 8~9점 다각형(POLYGON)으로 직접
 * 트레이싱한다 — 손톱 끝(free edge) 둥근 아치, 좌우 손톱벽(side wall), 큐티클
 * 라인(손톱이 피부 속으로 들어가는 굽은 경계)까지 좌표를 각각 찍는다.
 *
 * 측정 방법: hand.webp를 손가락별로 크롭한 뒤 20px 격자(100px마다 좌표 라벨)를
 * 겹쳐 5배 확대한 이미지를 육안으로 읽어 다각형 꼭짓점을 원본(1000×1796)
 * 좌표로 직접 찍었다(scripts/_scratch-grid-fingers.mts — 확인용 스크래치,
 * 커밋 대상 아님, /tmp/nailwork/v6-trace/*-grid.png에 그리드 오버레이 저장됨).
 * 엄지는 카메라 앵글상 손톱이 거의 옆면으로 보여(손톱판 대부분이 이미지 왼쪽
 * 가장자리에 좁고 대각선으로 붙음) 다른 네 손톱보다 다각형이 더 사선적이다.
 *
 * rx/ry/rotationDeg/cx/cy는 하위 호환용으로 다각형에서 자동 유도한
 * "근사 방향 경계 타원"이다 — 텍스처 타일 크기 계산(OVERSCAN 등, generate-nail-
 * candidates-v4/v5.mts)에서만 쓰이고, 화면에 실제로 보이는 마스크 형태는 항상
 * points(다각형)를 우선 사용한다(renderNailMaskAlpha 참고).
 */
export interface NailMask {
  /** 한글 손가락 이름 */
  name: string;
  /** 손톱판 윤곽을 직접 트레이싱한 다각형 정점(원본 1000×1796 좌표계, 시계방향) */
  points: [number, number][];
  /** 다각형에서 유도한 근사 중심(하위 호환 — 텍스처 타일 배치용) */
  cx: number;
  cy: number;
  /** 다각형에서 유도한 근사 방향 반지름(하위 호환 — 텍스처 타일 크기 계산용) */
  rx: number;
  ry: number;
  /** 다각형 장축 방향(도, 시계방향) — 텍스처 타일 회전에 사용 */
  rotationDeg: number;
}

interface OrientedBox {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  rotationDeg: number;
}

/**
 * 다각형 정점에서 PCA로 "근사 방향 경계 상자"를 유도한다 — 텍스처 타일
 * 배치/회전 코드가 기존처럼 cx/cy/rx/ry/rotationDeg를 쓸 수 있게 하기 위함.
 * 실제 마스크 형태(화면에 보이는 부분)는 이 값이 아니라 points 자체로
 * 그려지므로, 여기서 약간의 근사 오차가 있어도 시각적 결과에 영향 없다.
 */
function orientedBoxFromPoints(points: [number, number][]): OrientedBox {
  const n = points.length;
  const cx = points.reduce((s, p) => s + p[0], 0) / n;
  const cy = points.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (const [x, y] of points) {
    const dx = x - cx, dy = y - cy;
    sxx += dx * dx; syy += dy * dy; sxy += dx * dy;
  }
  sxx /= n; syy /= n; sxy /= n;
  // 공분산 행렬 [[sxx,sxy],[sxy,syy]]의 주고유벡터 각도(장축 = 손끝→큐티클 방향)
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const cos = Math.cos(theta), sin = Math.sin(theta);
  let maxU = 0, maxV = 0;
  for (const [x, y] of points) {
    const dx = x - cx, dy = y - cy;
    const u = dx * cos + dy * sin; // 장축(대략 손끝-큐티클) 투영
    const v = -dx * sin + dy * cos; // 단축(손톱 폭) 투영
    maxU = Math.max(maxU, Math.abs(u));
    maxV = Math.max(maxV, Math.abs(v));
  }
  // rx=가로(짧은축), ry=세로(긴축) 관례를 유지 — v를 rx, u를 ry로 매핑
  return { cx, cy, rx: maxV, ry: maxU, rotationDeg: (theta * 180) / Math.PI + 90 };
}

function polygonToSvgPoints(points: [number, number][]): string {
  return points.map((p) => `${p[0]},${p[1]}`).join(' ');
}

/**
 * NAIL_MASKS를 W×H 그레이스케일 알파 버퍼(1채널, 0~255)로 래스터라이즈한다.
 * 손톱 다섯 개(다각형)를 흰색으로, 배경은 검정으로 그린 뒤 가우시안 블러로
 * 가장자리를 1.5~3px 페더링한다(하드 컷아웃 방지 — 브리프 지시사항).
 */
export async function renderNailMaskAlpha(W: number, H: number, featherSigma = 2.0): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  // 2배 초해상도로 그린 뒤 다운샘플 — 다각형이 이미 스플라인으로 조밀화돼
  // 있지만, 래스터라이즈 단계의 계단현상까지 한 번 더 지워 곡선을 매끈하게
  // 만든다(브리프: "고해상도로 래스터라이즈 후 다운샘플").
  const SS = 2;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SS}" height="${H * SS}"><rect width="${W * SS}" height="${H * SS}" fill="black"/>`;
  for (const m of NAIL_MASKS) {
    svg += `<polygon points="${polygonToSvgPoints(m.points.map(([x, y]) => [x * SS, y * SS]))}" fill="white"/>`;
  }
  svg += `</svg>`;
  const { data } = await sharp(Buffer.from(svg))
    .blur(featherSigma * SS)
    .resize(W, H, { kernel: 'lanczos3' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data; // W*H, 1채널
}

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 손톱 하나(다각형)를 넉넉히 감싸는 크롭 사각형을 계산한다 — 다각형의 축정렬
 * 바운딩박스에 marginScale·marginPx로 손끝 주변 피부까지 여유 있게 포함시킨다.
 * 원본 이미지 경계(W×H)를 넘지 않게 클램프한다.
 */
export function nailCropRect(m: NailMask, W: number, H: number, marginScale = 1.6, marginPx = 36): CropRect {
  const xs = m.points.map((p) => p[0]);
  const ys = m.points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
  const halfW = ((maxX - minX) / 2) * marginScale + marginPx;
  const halfH = ((maxY - minY) / 2) * marginScale + marginPx;
  const left = Math.max(0, Math.round(cx - halfW));
  const top = Math.max(0, Math.round(cy - halfH));
  const right = Math.min(W, Math.round(cx + halfW));
  const bottom = Math.min(H, Math.round(cy + halfH));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * 2026-08-04 재트레이싱(6차 라운드): /tmp/nailwork/v6-trace/*-grid.png의 20px
 * 격자 위에서 손가락별로 손톱판의 실제 윤곽(첨단 아치, 좌우 측벽, 큐티클 곡선)을
 * 다각형 정점으로 직접 읽었다. 기존 타원 마스크는 다섯 손톱 모두에서 실제
 * 손톱판보다 컸다(특히 엄지·검지·소지는 손끝 피부까지 덮었다) — 아래 다각형은
 * 그보다 뚜렷이 작고, 큐티클 쪽이 곧은 타원 하단이 아니라 실제 큐티클 라인의
 * 굽은 모양(중앙이 손끝 쪽으로 살짝 파고드는 "스마일 라인")을 따른다.
 */
const RAW_POINTS: { name: string; points: [number, number][] }[] = [
  // 엄지 — 카메라 앵글상 손톱이 거의 옆면으로 보임(손톱판 대부분이 이미지
  // 왼쪽 가장자리에 좁고 대각선으로 붙어 있음). 큐티클 라인은 화면에 보이는
  // 뚜렷한 대각선 홍조 경계선을 그대로 따라간다.
  {
    name: '엄지',
    points: [
      [10, 572], [39, 566], [56, 578], [60, 595],
      [54, 632], [30, 648], [4, 630],
    ],
  },
  // 검지 — 정면에 가까운 뷰. 첨단 아치 + 거의 수직인 측벽 + 완만한 큐티클
  // "스마일 라인"(중앙이 손끝 쪽으로 살짝 들어옴).
  {
    name: '검지',
    points: [
      [346, 70], [378, 61], [409, 70], [409, 134],
      [412, 157], [378, 170], [346, 158], [337, 134],
    ],
  },
  // 중지 — 2026-08-04(6r4 라운드) 재트레이싱. v6~v6r3의 원본 좌표가 실제
  // 손톱판보다 좌측·좁게 찍혀 있었다(컨트롤러 진단, v6r3 리포트 참고). hand.webp를
  // 480~660(x)/0~170(y) 구간 4배 확대 + 20px 격자로 재확인해 좌우 손톱벽과
  // 큐티클 스마일 라인을 다시 찍었다 — 이미지 최상단에 가장 가깝게 잘려 있어
  // 첨단이 크롭 경계와 거의 맞닿는 점(y=2)은 동일.
  {
    name: '중지',
    points: [
      [548, 15], [580, 2], [612, 15], [626, 45],
      [612, 88], [578, 108], [540, 96], [522, 45],
    ],
  },
  // 약지 — 2026-08-04(6r4 라운드) 재트레이싱. 중지와 동일 사유(v6~v6r3 원본
  // 좌표가 좌측·좁게 편향). hand.webp를 670~870(x)/60~260(y) 구간 4배 확대 +
  // 20px 격자로 재확인해 좌우 손톱벽·큐티클을 다시 찍었다. 손가락이 오른쪽으로
  // 살짝 기울어 다각형 전체가 약 12~15도 시계 방향으로 회전된 형태는 동일.
  {
    name: '약지',
    points: [
      [730, 112], [768, 98], [805, 112], [818, 145],
      [805, 190], [768, 206], [725, 195], [715, 145],
    ],
  },
  // 소지 — 이미지 오른쪽 가장자리에 가장 가깝게 붙어 있다(오른쪽 측벽이
  // x=995로 프레임 경계 5px 앞까지 감).
  {
    name: '소지',
    points: [
      [930, 376], [962, 358], [992, 380], [995, 398],
      [990, 426], [962, 440], [922, 432], [914, 400],
    ],
  },
];

/**
 * 2026-08-04 6차 라운드 게이트 검수(컨트롤러)에서 재기각된 결함 2건에 대한
 * 지오메트리 보정(라운드 "6r"):
 *
 * 1. **다각형 모서리가 그대로 보임.** 8점(엄지는 7점) 다각형을 그대로
 *    렌더링하면 특히 어두운 액센트 색(중지·약지)에서 팔각형 각진 윤곽이
 *    선명하게 드러난다. 실제 손톱판 경계는 어디에도 직선이 없다.
 * 2. **커버리지 부족.** 원본 다각형이 실제 손톱판 경계보다 안쪽에 있어
 *    특히 첨단(free edge, 흰 라인 부분)과 측벽 쪽에 맨손톱 밴드가
 *    남는다 — "매니큐어"가 아니라 "반쯤 칠하다 만 것"으로 보인다.
 *
 * 아래 두 함수(`expandTowardFreeEdge`, `smoothClosedPolygon`)가 RAW_POINTS를
 * 다듬어 NAIL_MASKS.points를 만든다. 순서: (a) 각 정점을 중심에서 바깥으로
 * 밀어내되, 첨단(라운드 트레이싱 당시 y가 가장 작은 정점 = 손끝 방향) 쪽은
 * 크게, 큐티클(y가 가장 큰 정점) 쪽은 거의 밀지 않는다 — "큐티클 쪽 자연스러운
 * 아치는 그대로 두고, 첨단·측벽만 실제 경계까지 채운다"는 브리프 지시를 그대로
 * 구현한 것. (b) 그 확장된 다각형을 닫힌 centripetal Catmull-Rom 스플라인으로
 * 조밀하게 재샘플링해(정점당 8구간 보간 → 손톱당 56~64점) 직선 변을 남기지
 * 않는 매끄러운 곡선으로 만든다.
 */

/** 중심에서 바깥으로: 첨단(y 최소) 쪽은 EXPAND_TIP, 큐티클(y 최대) 쪽은
 * EXPAND_CUTICLE로 선형 보간한 배율만큼 각 정점을 밀어낸다. */
function expandTowardFreeEdge(points: [number, number][], expandTip: number, expandCuticle: number): [number, number][] {
  const n = points.length;
  const cx = points.reduce((s, p) => s + p[0], 0) / n;
  const cy = points.reduce((s, p) => s + p[1], 0) / n;
  const ys = points.map((p) => p[1]);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(1, maxY - minY);
  return points.map(([x, y]) => {
    const t = (y - minY) / span; // 0=첨단, 1=큐티클
    const scale = expandTip + (expandCuticle - expandTip) * t;
    return [cx + (x - cx) * scale, cy + (y - cy) * scale];
  });
}

/** 닫힌 centripetal Catmull-Rom 스플라인으로 다각형을 조밀화한다(20점 이상
 * 보장, 직선 변을 매끄러운 곡선으로 대체 — 게이트 (a) "각진 모서리 없음"을
 * 만족시키기 위함). `samplesPerSeg`개씩 각 변 사이를 보간한다. */
function smoothClosedPolygon(points: [number, number][], samplesPerSeg = 8): [number, number][] {
  const n = points.length;
  const out: [number, number][] = [];
  const P = (i: number) => points[((i % n) + n) % n];
  const alpha = 0.5; // centripetal
  const tj = (ti: number, pi: [number, number], pj: [number, number]): number => {
    const dx = pj[0] - pi[0], dy = pj[1] - pi[1];
    const d = Math.sqrt(dx * dx + dy * dy) || 1e-6;
    return ti + Math.pow(d, alpha);
  };
  for (let i = 0; i < n; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    const t0 = 0;
    const t1 = tj(t0, p0, p1);
    const t2 = tj(t1, p1, p2);
    const t3 = tj(t2, p2, p3);
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = t1 + ((t2 - t1) * s) / samplesPerSeg;
      const A1 = lerpPt(p0, p1, t0, t1, t);
      const A2 = lerpPt(p1, p2, t1, t2, t);
      const A3 = lerpPt(p2, p3, t2, t3, t);
      const B1 = lerpPt(A1, A2, t0, t2, t);
      const B2 = lerpPt(A2, A3, t1, t3, t);
      const C = lerpPt(B1, B2, t1, t2, t);
      out.push(C);
    }
  }
  return out;
}

function lerpPt(p: [number, number], q: [number, number], tp: number, tq: number, t: number): [number, number] {
  if (tq === tp) return p;
  const f = (t - tp) / (tq - tp);
  return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
}

/**
 * 2026-08-04 6r2 라운드 게이트 재기각 결함 1("다각형 모서리는 사라졌지만
 * 윤곽이 울퉁불퉁한 구름처럼 흔들림")에 대한 보정 — 손으로 찍은 원본 점(RAW_POINTS,
 * 7~8점)은 완벽한 매끄러운 곡선 위에 있지 않고 트레이싱 특유의 미세한 좌표
 * 노이즈를 갖는다. 이 노이즈를 스플라인 조밀화 *이전에* 통제점 자체에서
 * 지워야 한다.
 *
 * 2026-08-04 6r3 라운드 재기각(컨트롤러 진단) — 6r2에서 쓴 단순 라플라시안
 * 이동평균(순방향 factor=0.35, 2회 반복)은 "이웃 두 점의 중점으로 끌어당김"을
 * 반복하는 방식이라 볼록 다각형을 반드시 **중심 쪽으로 수축**시킨다(라플라시안
 * 스무딩의 잘 알려진 성질). 액센트 손톱(중지·약지)처럼 통제점이 적고(8점)
 * 원래도 둥근 편인 다각형에서는 이 수축이 누적돼 타원이 아니라 원(blob)에
 * 가까워졌고, 그만큼 확보했던 커버리지(첨단·측벽)도 다시 줄어 맨손톱 밴드가
 * 재발했다. 그래서 라플라시안 대신 **Taubin 스무딩**(λ/μ 2단계)으로 교체한다:
 * 1단계(λ=+0.5)로 라플라시안과 동일하게 이웃 평균 쪽으로 이동해 노이즈를
 * 지우고, 2단계(μ=-0.53, |μ|>λ)로 *반대 방향*(바깥쪽)으로 더 크게 이동시켜
 * 저주파(전체 크기/둘레)는 원래대로 복원하면서 고주파 노이즈만 제거한다 —
 * "shrinkage-free" 스무딩으로 알려진 표준 기법(Taubin, 1995). 결과적으로
 * 둘레·면적이 원래 다각형과 거의 같게 유지되면서도 트레이싱 노이즈로 인한
 * 파형은 사라진다.
 */
function taubinSmoothControlPoints(
  points: [number, number][],
  iterations = 6,
  lambda = 0.5,
  mu = -0.53,
): [number, number][] {
  const n = points.length;
  const step = (pts: [number, number][], factor: number): [number, number][] => {
    const next: [number, number][] = new Array(n);
    for (let i = 0; i < n; i++) {
      const prev = pts[(i - 1 + n) % n];
      const cur = pts[i];
      const nxt = pts[(i + 1) % n];
      const avgX = (prev[0] + nxt[0]) / 2;
      const avgY = (prev[1] + nxt[1]) / 2;
      next[i] = [cur[0] + factor * (avgX - cur[0]), cur[1] + factor * (avgY - cur[1])];
    }
    return next;
  };
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    pts = step(pts, lambda);
    pts = step(pts, mu);
  }
  return pts;
}

// 확장 배율: 첨단(free edge) 쪽은 넉넉히(흰 팁까지 커버), 큐티클 쪽은
// 최소한만(자연스러운 스마일 라인 아치를 유지, 피부 스필 방지).
const EXPAND_TIP = 1.08;
const EXPAND_CUTICLE = 1.02;

export const NAIL_MASKS: NailMask[] = RAW_POINTS.map(({ name, points }) => {
  const expanded = expandTowardFreeEdge(points, EXPAND_TIP, EXPAND_CUTICLE);
  const smoothedControl = taubinSmoothControlPoints(expanded, 6, 0.5, -0.53);
  const smoothed = smoothClosedPolygon(smoothedControl, 8);
  const box = orientedBoxFromPoints(smoothed);
  return { name, points: smoothed, ...box };
});

/**
 * 6r2 게이트 재기각 결함 2("약지 큐티클 쪽 페더가 에어브러시처럼 넓게 번짐")에
 * 대한 보정 — 기존에는 손톱 전체에 균일한 시그마(2.0px)로 가우시안 블러를
 * 적용했다. 하지만 첨단(free edge, 흰 팁) 쪽은 2.0px 정도의 부드러운 페더가
 * 자연스러운 반면, 큐티클(스마일 라인) 쪽은 더 좁아야 진짜 매니큐어 경계처럼
 * 보인다. 이 함수는 손톱 하나에 대해 첨단 쪽 블러(tipSigma)와 큐티클 쪽
 * 블러(cuticleSigma)를 각각 렌더링한 뒤, 다각형의 첨단→큐티클 y축 진행률(t,
 * expandTowardFreeEdge와 동일한 정의: y 최소=첨단(t=0), y 최대=큐티클(t=1))로
 * 두 결과를 행(row) 단위로 선형 블렌드해 "첨단은 그대로, 큐티클만 좁게"
 * 페더링한다.
 */
export async function renderNailFeatherAlpha(
  m: NailMask,
  W: number,
  H: number,
  tipSigma = 2.0,
  cuticleSigma = 1.5,
): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  const SS = 2;
  const pts = m.points.map(([x, y]) => `${x * SS},${y * SS}`).join(' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SS}" height="${H * SS}"><rect width="${W * SS}" height="${H * SS}" fill="black"/><polygon points="${pts}" fill="white"/></svg>`;
  const svgBuf = Buffer.from(svg);

  const render = async (sigma: number): Promise<Buffer> => {
    const { data } = await sharp(svgBuf)
      .blur(sigma * SS)
      .resize(W, H, { kernel: 'lanczos3' })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    return data;
  };
  const [tipAlpha, cuticleAlpha] = await Promise.all([render(tipSigma), render(cuticleSigma)]);

  const ys = m.points.map((p) => p[1]);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const span = Math.max(1, maxY - minY);
  const rowT = new Float64Array(H);
  for (let y = 0; y < H; y++) {
    rowT[y] = Math.min(1, Math.max(0, (y - minY) / span));
  }

  const out = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++) {
    const t = rowT[y];
    const base = y * W;
    for (let x = 0; x < W; x++) {
      const i = base + x;
      out[i] = Math.round(tipAlpha[i] * (1 - t) + cuticleAlpha[i] * t);
    }
  }
  return out;
}
