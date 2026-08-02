import { describe, it, expect } from 'vitest';
import { frameAt, MORPH, MORPH_TOTAL } from '@/components/story/heroMorph';

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

  it('흡수 끝: 궤도 반경 0, 중심이 손톱 쪽(y 0.18)으로 이동', () => {
    const f = frameAt(e3 - 1);
    expect(f.orbitR).toBeCloseTo(0, 1);
    expect(f.center.y).toBeCloseTo(0.18, 1);
  });

  it('재탄생 구간에서 reveal이 단조 증가', () => {
    const a = frameAt(e3 + MORPH.reveal * 0.25).reveal;
    const b = frameAt(e3 + MORPH.reveal * 0.75).reveal;
    expect(b).toBeGreaterThan(a);
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
});
