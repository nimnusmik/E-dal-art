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

export const NAIL_MASKS: NailMask[] = [
  // 엄지 — 옆에서 보이는 각도라 손톱판이 크게(약 -48도) 기울어져 있다.
  { name: '엄지', cx: 60, cy: 610, rx: 44, ry: 54, rotationDeg: -50 },
  // 검지 — 3차 미세 보정(과보정된 우측 이동을 되돌리고 아래로 살짝, 반경 확대)
  { name: '검지', cx: 378, cy: 128, rx: 66, ry: 66, rotationDeg: -5 },
  // 중지 — 거의 수직. 1차 오버레이에서 위쪽이 잘려 ry 확대 + cy 상향 보정.
  { name: '중지', cx: 590, cy: 98, rx: 60, ry: 85, rotationDeg: 0 },
  // 약지 — 4차 미세 보정(위쪽 손톱 팁이 잘려 위로, 폭 살짝 확대)
  { name: '약지', cx: 765, cy: 133, rx: 55, ry: 60, rotationDeg: 10 },
  // 소지 — 더 크게 오른쪽으로 기움. 1차 오버레이에서 살짝 좌하단으로 보정.
  { name: '소지', cx: 928, cy: 412, rx: 42, ry: 55, rotationDeg: 15 },
];
