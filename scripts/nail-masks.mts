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
export async function renderNailMaskAlpha(W: number, H: number, featherSigma = 1.0): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="black"/>`;
  for (const m of NAIL_MASKS) {
    svg += `<polygon points="${polygonToSvgPoints(m.points)}" fill="white"/>`;
  }
  svg += `</svg>`;
  const { data } = await sharp(Buffer.from(svg))
    .blur(featherSigma)
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
  // 중지 — 이미지 최상단에 가장 가깝게 잘려 있어 첨단이 크롭 경계와 거의
  // 맞닿는다(y=2). 폭이 다섯 손톱 중 가장 좁다.
  {
    name: '중지',
    points: [
      [544, 18], [578, 2], [608, 18], [611, 52],
      [604, 88], [578, 102], [543, 94], [531, 60],
    ],
  },
  // 약지 — 손가락이 오른쪽으로 살짝 기울어 다각형 전체가 약 12~15도 시계
  // 방향으로 회전된 형태.
  {
    name: '약지',
    points: [
      [734, 116], [770, 102], [808, 118], [820, 146],
      [810, 192], [770, 204], [728, 196], [720, 150],
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

export const NAIL_MASKS: NailMask[] = RAW_POINTS.map(({ name, points }) => {
  const box = orientedBoxFromPoints(points);
  return { name, points, ...box };
});
