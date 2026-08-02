/**
 * 히어로 변신 루프의 순수 타임라인 — 시각(ms) → 프레임 상태.
 * DOM을 모르는 순수 함수라 유닛 테스트 가능. 렌더는 HeroHand가 담당.
 */
export const MORPH = {
  holdStart: 2000, // 맨손 + 영감 카드 정지
  swirl: 3000,     // 카드가 구슬이 되어 손 주위 소용돌이
  absorb: 800,     // 구슬이 손톱 쪽으로 빨려 들어감
  reveal: 900,     // 손톱부터 원형으로 완성 손 리빌
  holdEnd: 4000,   // 완성 정지 (CTA 읽을 시간)
  back: 800,       // 맨손 + 카드로 복귀
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
 * 카드 입장(hero-rise) CSS 애니메이션이 끝나는 최악 시각(ms) — app/globals.css의
 * `.inspo-cut.at-bottom-right { animation-delay: 0.45s }` + `hero-rise 0.6s` = 1050ms.
 * MORPH.holdStart(카드를 루프가 건드리기 시작하는 시점)가 이 값보다 커야 입장 애니메이션이
 * 루프에 의해 중간에 끊기지 않는다. CSS 쪽 delay·duration을 바꾸면 이 값도 같이 갱신할 것.
 */
export const CARD_ENTRANCE_MAX_MS = 1050;

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

  if (t < e2) { // 소용돌이
    const u = (t - e1) / MORPH.swirl;
    f.cardAlpha = 1 - clamp01(u * 3); // 초반에 빠르게 카드 → 구슬 교대
    f.beadAlpha = clamp01(u * 3);
    f.orbitR = lerp(0.42, 0.28, easeOut(clamp01(u * 1.4)));
    f.spin = easeInOut(u) * Math.PI * 2.4;
    return f;
  }

  if (t < e3) { // 흡수 — 손톱 쪽으로 빨려 들어감
    const u = easeInOut((t - e2) / MORPH.absorb);
    f.cardAlpha = 0;
    f.beadAlpha = 1 - clamp01((u - 0.7) / 0.3); // 막판에만 사라짐
    f.beadScale = lerp(1, 0.24, u);
    f.orbitR = lerp(0.28, 0, u);
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
