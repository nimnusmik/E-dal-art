/**
 * public/hero/hand.webp(1000×1796, 손등 뷰) 안의 손톱 5개 위치를 고정 좌표로
 * 하드코딩한다. hand.webp 픽셀은 앞으로도 절대 바뀌지 않으므로(재생성 금지 —
 * "손 전체 재생성" 대신 "손톱 영역만 합성" 방식으로 전환, 2026-08-03 결정) 이
 * 좌표를 한 번만 눈으로 확인해 고정하면 계속 재사용할 수 있다.
 *
 * 각 손톱은 회전된 타원(ellipse)으로 근사한다 — 손톱판(nail plate)이 대략
 * 손가락 축을 따라 기울어진 둥근 사각/타원 형태이기 때문이다. 좌표는
 * /tmp/nailwork/hand-grid-labeled.png(20px 격자, 100px 라벨)를 손가락별로
 * 크롭해 육안으로 측정했다(scripts/_scratch-grid5.mts, _scratch-crop5.mts —
 * 확인용 스크래치, 커밋 대상 아님).
 */
export interface NailMask {
  /** 한글 손가락 이름 */
  name: string;
  /** 타원 중심 (원본 1000×1796 좌표계) */
  cx: number;
  cy: number;
  /** 타원 반지름 (회전 전, x=가로/짧은축, y=세로/긴축) */
  rx: number;
  ry: number;
  /** 시계방향 회전각(도) — 손가락이 기운 방향을 따라간다 */
  rotationDeg: number;
}

/**
 * NAIL_MASKS를 W×H 그레이스케일 알파 버퍼(1채널, 0~255)로 래스터라이즈한다.
 * 손톱 다섯 개를 흰색으로, 배경은 검정으로 그린 뒤 가우시안 블러로 가장자리를
 * 1.5~3px 페더링한다(하드 컷아웃 방지 — 브리프 지시사항).
 */
export async function renderNailMaskAlpha(W: number, H: number, featherSigma = 1.0): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="black"/>`;
  for (const m of NAIL_MASKS) {
    svg += `<g transform="rotate(${m.rotationDeg} ${m.cx} ${m.cy})"><ellipse cx="${m.cx}" cy="${m.cy}" rx="${m.rx}" ry="${m.ry}" fill="white"/></g>`;
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
 * 손톱 하나(회전된 타원)를 넉넉히 감싸는 크롭 사각형을 계산한다(2차 라운드:
 * 손톱별 개별 크롭→생성→합성 파이프라인용). 회전된 타원의 축정렬 바운딩박스를
 * 구한 뒤, marginScale·marginPx로 손끝 주변 피부까지 여유 있게 포함시킨다
 * (모델이 "이 손톱에" 그리라는 문맥을 알 수 있도록 큐티클·측면 피부가 보여야 함).
 * 원본 이미지 경계(W×H)를 넘지 않게 클램프한다.
 */
export function nailCropRect(m: NailMask, W: number, H: number, marginScale = 1.6, marginPx = 36): CropRect {
  const rad = (m.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad), sin = Math.sin(rad);
  const halfW = Math.sqrt((m.rx * cos) ** 2 + (m.ry * sin) ** 2) * marginScale + marginPx;
  const halfH = Math.sqrt((m.rx * sin) ** 2 + (m.ry * cos) ** 2) * marginScale + marginPx;
  const left = Math.max(0, Math.round(m.cx - halfW));
  const top = Math.max(0, Math.round(m.cy - halfH));
  const right = Math.min(W, Math.round(m.cx + halfW));
  const bottom = Math.min(H, Math.round(m.cy + halfH));
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * 2026-08-03 재측정(2차 라운드): 격자 오버레이(20px 격자, 4~5배 확대) 위에서
 * 손가락별로 손톱판의 실제 끝점(첨단/좌우 폭/큐티클 라인)을 픽셀 좌표로 직접 읽어
 * 재계산했다. 기존 값들은 육안상 "대략 근처"였으나 특히 엄지(손톱 절반만 덮음),
 * 중지(ry가 실제보다 60px 이상 커서 손톱 아래 피부까지 덮음), 소지(중심이 실제
 * 손톱보다 좌측으로 치우침)에서 실측과 20px 이상 어긋나 있었다 —
 * /tmp/nailwork/grid-*.png 참고(스크래치, 커밋 대상 아님).
 */
export const NAIL_MASKS: NailMask[] = [
  // 엄지 — 폴리시 없는 맨손톱이라 피부와 색 대비가 낮아 가장 측정이 어려웠음.
  // 처음엔 손가락 옆면의 밝은 하이라이트 띠를 손톱으로 오인해 중심을 오른쪽으로
  // 너무 옮겼었으나(실측 오류), 자세히 보면 그 하이라이트는 엄지 살집의 굴곡일
  // 뿐이고 실제 손톱(옅은 라벤더빛 판+큐티클 라인)은 이미지 왼쪽 가장자리에
  // 훨씬 작게 붙어 있음 — 여러 차례 재측정 후 왼쪽 가장자리에 작게 확정.
  { name: '엄지', cx: 85, cy: 630, rx: 65, ry: 80, rotationDeg: -15 },
  // 검지 — 실측 bbox x:305~460, y:65~175. 기존값과 중심은 비슷했으나 반경이
  // 약간 작아 우측·하단이 살짝 잘렸음 — 반경만 확대.
  { name: '검지', cx: 382, cy: 120, rx: 77, ry: 57, rotationDeg: -3 },
  // 중지 — 실측 bbox x:520~640, y:8~105. 기존 ry=85(=cy 98 기준 13~183)는
  // 실제 손톱(8~105)보다 훨씬 아래까지 뻗어 피부를 덮고 있었고, 정작 첨단은
  // 살짝 잘렸음 — cy를 위로, ry를 크게 축소.
  { name: '중지', cx: 582, cy: 58, rx: 62, ry: 52, rotationDeg: 0 },
  // 약지 — 실측 bbox x:705~790, y:100~215. 기존 cy=133은 실제 중심(157)보다
  // 24px 위쪽이라 손톱 하단이 잘리고 있었음 — 아래로 이동, 반경 소폭 확대.
  { name: '약지', cx: 747, cy: 157, rx: 48, ry: 60, rotationDeg: 12 },
  // 소지 — 실측 bbox x:905~985, y:355~480. 기존 cx=928은 실제 중심(948)보다
  // 좌측이라 손톱 우측 절반이 마스크 밖에 있었음 — 우측으로 이동.
  { name: '소지', cx: 948, cy: 415, rx: 48, ry: 68, rotationDeg: 13 },
];
