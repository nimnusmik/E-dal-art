import { describe, it, expect } from 'vitest';
import {
  beadLayoutAt,
  CARD_ENTRANCE_MAX_MS,
  frameAt,
  HAND_HALF_WIDTH_FRAC,
  MORPH,
  MORPH_TOTAL,
  NAIL_Y,
} from '@/components/story/heroMorph';

const e1 = MORPH.holdStart;
const e2 = e1 + MORPH.swirl;
const e3 = e2 + MORPH.absorb;
const e4 = e3 + MORPH.reveal;
const e5 = e4 + MORPH.holdEnd;

describe('frameAt — 히어로 변신 타임라인', () => {
  it('전체 길이는 11.5초', () => {
    expect(MORPH_TOTAL).toBe(11500);
    expect(e5 + MORPH.back).toBe(MORPH_TOTAL);
  });

  it('정지 구간: 카드만 보이고 구슬·리빌 없음', () => {
    const f = frameAt(0);
    expect(f.cardAlpha).toBe(1);
    expect(f.beadAlpha).toBe(0);
    expect(f.reveal).toBe(0);
  });

  it('소용돌이 중반: 구슬이 보이고 카드는 사라짐', () => {
    const f = frameAt(e1 + MORPH.swirl / 2);
    expect(f.beadAlpha).toBe(1);
    expect(f.cardAlpha).toBe(0);
    expect(f.orbitR).toBeGreaterThan(0);
  });

  it('소용돌이 내내 궤도 반경이 손 실루엣 절반 폭(HAND_HALF_WIDTH_FRAC)을 여유 있게 넘는다', () => {
    // 구슬 반경(대략 0.06~0.09 무대폭 비율)까지 감안해도 좌우 극단이 손 실루엣 밖으로
    // 나가야 "손 위에 얹힌 스티커"가 아니라 "손을 두른 링"으로 보인다.
    const BEAD_HALF_WIDTH_FRAC_MAX = 0.1; // 넉넉히 잡은 상한
    for (let u = 0; u <= 1; u += 0.1) {
      const { orbitR } = frameAt(e1 + MORPH.swirl * u);
      expect(orbitR).toBeGreaterThan(HAND_HALF_WIDTH_FRAC + BEAD_HALF_WIDTH_FRAC_MAX);
    }
  });

  it('흡수 끝: 궤도 반경 0, 중심이 손톱 쪽(NAIL_Y)으로 이동', () => {
    const f = frameAt(e3 - 1);
    expect(f.orbitR).toBeCloseTo(0, 1);
    expect(f.center.y).toBeCloseTo(NAIL_Y, 1);
  });

  it('재탄생 구간에서 reveal이 단조 증가, 중심은 NAIL_Y에 고정', () => {
    const a = frameAt(e3 + MORPH.reveal * 0.25).reveal;
    const b = frameAt(e3 + MORPH.reveal * 0.75).reveal;
    expect(b).toBeGreaterThan(a);
    expect(frameAt(e3 + MORPH.reveal * 0.5).center.y).toBe(NAIL_Y);
  });

  it('완성 정지: reveal 1, 카드·구슬 없음', () => {
    const f = frameAt(e4 + MORPH.holdEnd / 2);
    expect(f.reveal).toBe(1);
    expect(f.cardAlpha).toBe(0);
    expect(f.beadAlpha).toBe(0);
  });

  it('복귀 끝 무렵: 카드가 돌아오고 reveal이 줄어듦', () => {
    const f = frameAt(e5 + MORPH.back * 0.9);
    expect(f.cardAlpha).toBeGreaterThan(0.5);
    expect(f.reveal).toBeLessThan(0.5);
  });

  it('루프: TOTAL을 넘긴 시각은 나머지 시각과 같은 프레임', () => {
    expect(frameAt(MORPH_TOTAL + 10)).toEqual(frameAt(10));
  });

  it('holdStart는 카드 입장 CSS 애니메이션 최악 시각보다 길어야 한다', () => {
    // app/globals.css의 .inspo-cut.at-bottom-right 지연(0.45s) + hero-rise(0.6s) = 1050ms.
    // 이보다 짧으면 루프가 카드 소유권을 가져가는 시점이 입장 애니메이션 도중이 되어 끊긴다.
    expect(MORPH.holdStart).toBeGreaterThan(CARD_ENTRANCE_MAX_MS);
  });
});

describe('beadLayoutAt — 구슬 3D 원근 레이아웃', () => {
  const N = 4;

  it('가장 먼 지점(depth=-1)에서는 뒤(behind)이고 작고 흐리다', () => {
    const far = beadLayoutAt(-Math.PI / 2, 0, N);
    expect(far.depth).toBeCloseTo(-1, 5);
    expect(far.front).toBe(false);
    expect(far.blurPx).toBeGreaterThan(0);
  });

  it('가장 가까운 지점(depth=1)에서는 앞(front)이고 크다', () => {
    const near = beadLayoutAt(Math.PI / 2, 0, N);
    expect(near.depth).toBeCloseTo(1, 5);
    expect(near.front).toBe(true);
    expect(near.blurPx).toBe(0);
  });

  it('가까운 구슬이 먼 구슬보다 크고 또렷하다 (원근감)', () => {
    const far = beadLayoutAt(-Math.PI / 2, 0, N);
    const near = beadLayoutAt(Math.PI / 2, 0, N);
    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.opacityMul).toBeGreaterThan(far.opacityMul);
  });

  it('뒤쪽 구슬은 앞쪽보다 더 위로 떠 손을 감싸는 궤적을 그린다', () => {
    const far = beadLayoutAt(-Math.PI / 2, 0, N);
    const near = beadLayoutAt(Math.PI / 2, 0, N);
    // 화면 좌표계는 y가 아래로 증가 — 더 위로 떠 있다는 건 yOffset이 더 작다(더 음수)는 뜻.
    expect(far.yOffset).toBeLessThan(-Math.abs(near.yOffset));
  });

  it('깊이는 랩어라운드에서도 연속적이다', () => {
    const a = beadLayoutAt(2 * Math.PI - 0.01, 0, N);
    const b = beadLayoutAt(2 * Math.PI + 0.01, 0, N);
    expect(Math.abs(a.depth - b.depth)).toBeLessThan(0.05);
  });

  it('depth가 -1..1 범위를 벗어나지 않는다', () => {
    for (let s = 0; s < 20; s += 1) {
      const spin = s * 0.37;
      const { depth } = beadLayoutAt(spin, 1, N);
      expect(depth).toBeGreaterThanOrEqual(-1.0001);
      expect(depth).toBeLessThanOrEqual(1.0001);
    }
  });

  it('좌우 극단의 구슬은 실제 소용돌이 반경에서 손 실루엣 밖을 지난다', () => {
    // spin=0일 때 i=0 구슬의 angle=0 → xOffset=cos(0)=1 (좌우 극단, wobble 없음).
    const { xOffset } = beadLayoutAt(0, 0, N);
    expect(xOffset).toBeCloseTo(1, 5);
    const { orbitR } = frameAt(MORPH.holdStart); // 소용돌이 진입 시점의 반경
    const edge = xOffset * orbitR; // 무대폭 대비 구슬 중심의 좌우 위치
    expect(edge).toBeGreaterThan(HAND_HALF_WIDTH_FRAC);
  });
});
