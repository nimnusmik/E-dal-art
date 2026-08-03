/**
 * 히어로 변신 루프의 순수 타임라인 — 시각(ms) → 프레임 상태.
 * DOM을 모르는 순수 함수라 유닛 테스트 가능. 렌더는 HeroHand가 담당.
 */
/**
 * 각 국면의 길이(ms). 움직이는 구간(소용돌이~복귀)은 짧게 두고 정지 구간을 길게 잡아,
 * 한 주기 중 실제로 화면이 움직이는 시간이 1/4 남짓이 되도록 한다 —
 * 첫 화면에서 무한 반복되는 움직임이 CTA 읽기를 방해하지 않게 하려는 의도.
 */
export const MORPH = {
  holdStart: 4000,  // 맨손 + 영감 카드 정지
  swirl: 3000,      // 카드가 구슬이 되어 손 주위 소용돌이
  absorb: 800,      // 구슬이 손톱 쪽으로 빨려 들어감
  reveal: 900,      // 손톱부터 원형으로 완성 손 리빌
  holdEnd: 12500,   // 완성 정지 (네일 아트를 충분히 보고 CTA를 읽을 시간)
  back: 800,        // 맨손 + 카드로 복귀
} as const;

export const MORPH_TOTAL =
  MORPH.holdStart + MORPH.swirl + MORPH.absorb + MORPH.reveal + MORPH.holdEnd + MORPH.back;

export interface MorphFrame {
  /** 영감 카드(라벨 박스) 불투명도 */
  cardAlpha: number;
  /** 구슬 불투명도 */
  beadAlpha: number;
  /** 구슬 크기 배율 */
  beadScale: number;
  /** 궤도 반경 — 무대 너비 대비 비율 */
  orbitR: number;
  /** 누적 회전(라디안) */
  spin: number;
  /** 플래시 강도 */
  flash: number;
  /** 완성 손 리빌 진행도 0..1 */
  reveal: number;
  /** 궤도 중심 — 무대 크기 대비 비율 (흡수 때 손톱 쪽으로 이동) */
  center: { x: number; y: number };
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** 손톱 무리의 무대 내 상대 위치 — hand.webp에서 손톱은 상단에 있다 */
export const NAIL_Y = 0.18;

/**
 * 손 실루엣이 무대(.hand-stage) 너비에서 차지하는 절반 폭(비율).
 * .hand-stage는 aspect-ratio: 3/4로 고정, .hand-img는 height:100%·width:auto라
 * 렌더 폭이 hand.webp 원본 비율(1000×1796)로만 정해진다 — 뷰포트 크기와 무관한 상수:
 *   렌더폭/무대폭 = (무대높이/무대폭) × (1000/1796) = (4/3) × 0.5568 ≈ 0.7424
 * 구슬 궤도 반경(frameAt이 계산하는 orbitR)이 이 값(절반 0.3712)보다 충분히 커야 손 실루엣을
 * 벗어나 "손을 감싸는 링"으로 보인다. hand.webp 치수나 이 aspect-ratio를 바꾸면
 * 이 값도 반드시 재계산할 것.
 */
export const HAND_HALF_WIDTH_FRAC = 0.372;

/**
 * 카드 입장(hero-rise) CSS 애니메이션이 끝나는 최악 시각(ms) — app/globals.css의
 * `.inspo-cut.at-bottom-right { animation-delay: 0.45s }` + `hero-rise 0.6s` = 1050ms.
 * MORPH.holdStart(카드를 루프가 건드리기 시작하는 시점)가 이 값보다 커야 입장 애니메이션이
 * 루프에 의해 중간에 끊기지 않는다. CSS 쪽 delay·duration을 바꾸면 이 값도 같이 갱신할 것.
 */
export const CARD_ENTRANCE_MAX_MS = 1050;

export interface BeadLayout {
  /** x 오프셋 — orbitR·무대폭 배율 전의 상대값(대략 -1..1) */
  xOffset: number;
  /** y 오프셋 — orbitR·무대폭 배율 전의 상대값. 뒤쪽(depth<0)일수록 더 위로 떠 손을 감싸듯 보인다 */
  yOffset: number;
  /** f.beadScale에 곱할 원근 배율 — 앞쪽일수록 크다 */
  scale: number;
  /** f.beadAlpha에 곱할 원근 배율 — 뒤쪽일수록 흐릿하다 */
  opacityMul: number;
  /** 뒤쪽일수록 커지는 흐림(px) */
  blurPx: number;
  /** 깊이: -1(가장 뒤) .. 1(가장 앞), 랩어라운드에서도 연속적 */
  depth: number;
  /** 손보다 앞에 그려야 하면 true (depth >= 0) */
  front: boolean;
}

/** 세로 궤도 진폭 — 가로(xOffset, 진폭 ~1) 대비 비율. 훌라후프처럼 손을 두르는
 *  링으로 보이게 하는 값 — 너무 작으면(0.2대) 좌우 왕복처럼, 너무 크면(0.6+)
 *  다시 평면 원판처럼 읽힌다. */
const BEAD_VERT_FACTOR = 0.38;
/** 뒤쪽(depth<0)일수록 더 위로 떠올리는 정도 — 먼 호가 손 위로 넘어가는 느낌 */
const BEAD_FAR_LIFT_FACTOR = 0.3;

/**
 * 구슬 하나의 궤도상 3D 원근 레이아웃 — 손을 평면적으로 굴러가는 게 아니라
 * 실제로 감싸고 도는 것처럼 보이도록 깊이(depth)에 따라 위치·크기·불투명도·흐림을 바꾼다.
 * depth = sin(angle): 앞(1)에서 손보다 위에, 뒤(-1)에서 손보다 뒤에 (occlusion은 z-index로 처리).
 * 반환하는 xOffset·yOffset은 orbitR·무대폭을 곱하기 전의 상대값(대략 -1..1) —
 * 실제 궤도가 손 실루엣을 벗어나는지는 orbitR 크기(HAND_HALF_WIDTH_FRAC 대비)에 달려 있다.
 */
export function beadLayoutAt(spin: number, i: number, N: number): BeadLayout {
  const angle = (i / N) * Math.PI * 2 + spin;
  const depth = Math.sin(angle); // -1(뒤) .. 1(앞), 연속
  // 반경에 구슬별 위상 흔들림 — 기계적 등속 원운동 탈피
  const wob = 1 + 0.06 * Math.sin(spin * 2 + i * 1.7);
  const xOffset = Math.cos(angle) * wob;
  // 뒤쪽(depth<0)일수록 더 위로 떠올려 "손 위를 굴러감"이 아닌 "손을 둘러싸고 돎"으로 읽히게 한다.
  const lift = depth < 0 ? -depth * BEAD_FAR_LIFT_FACTOR : 0;
  const yOffset = (depth * BEAD_VERT_FACTOR - lift) * wob;
  const near = (depth + 1) / 2; // 0(뒤) .. 1(앞)
  return {
    xOffset,
    yOffset,
    scale: lerp(0.6, 1.18, near),
    opacityMul: lerp(0.5, 1, near),
    blurPx: depth < 0 ? -depth * 2.4 : 0,
    depth,
    front: depth >= 0,
  };
}

export function frameAt(tMs: number): MorphFrame {
  const t = ((tMs % MORPH_TOTAL) + MORPH_TOTAL) % MORPH_TOTAL;
  const f: MorphFrame = {
    cardAlpha: 1, beadAlpha: 0, beadScale: 1, orbitR: 0,
    spin: 0, flash: 0, reveal: 0, center: { x: 0.5, y: 0.5 },
  };
  const e1 = MORPH.holdStart;
  const e2 = e1 + MORPH.swirl;
  const e3 = e2 + MORPH.absorb;
  const e4 = e3 + MORPH.reveal;
  const e5 = e4 + MORPH.holdEnd;

  if (t < e1) return f; // 정지 — 현재 히어로 그대로

  if (t < e2) { // 소용돌이 — 훌라후프처럼 손 실루엣 바깥을 도는 링
    const u = (t - e1) / MORPH.swirl;
    f.cardAlpha = 1 - clamp01(u * 3); // 초반에 빠르게 카드 → 구슬 교대
    f.beadAlpha = clamp01(u * 3);
    // SWIRL_ORBIT_*는 HAND_HALF_WIDTH_FRAC(0.372) + 구슬 반경 + 여백을 확실히 넘도록 잡은
    // 값 — 이보다 작으면 좌우 극단의 구슬이 손 실루엣 "안쪽"에 놓여 스티커처럼 보인다.
    f.orbitR = lerp(0.54, 0.5, easeOut(clamp01(u * 1.4)));
    f.spin = easeInOut(u) * Math.PI * 2.4;
    return f;
  }

  if (t < e3) { // 흡수 — 손톱 쪽으로 빨려 들어감
    const u = easeInOut((t - e2) / MORPH.absorb);
    f.cardAlpha = 0;
    f.beadAlpha = 1 - clamp01((u - 0.7) / 0.3); // 막판에만 사라짐
    f.beadScale = lerp(1, 0.24, u);
    f.orbitR = lerp(0.5, 0, u); // 소용돌이 끝 반경(0.5)에서 손톱 한 점으로 수렴
    f.spin = Math.PI * 2.4 + u * 0.8;
    f.center = { x: 0.5, y: lerp(0.5, NAIL_Y, u) };
    f.flash = u * 0.5;
    return f;
  }

  if (t < e4) { // 재탄생 — 손톱부터 원형 리빌
    const u = (t - e3) / MORPH.reveal;
    f.cardAlpha = 0;
    f.reveal = easeInOut(u);
    f.flash = 0.5 * (1 - u);
    f.center = { x: 0.5, y: NAIL_Y };
    return f;
  }

  if (t < e5) { // 완성 정지
    f.cardAlpha = 0;
    f.reveal = 1;
    return f;
  }

  // 복귀
  const u = easeInOut((t - e5) / MORPH.back);
  f.reveal = 1 - u;
  f.cardAlpha = u;
  return f;
}
