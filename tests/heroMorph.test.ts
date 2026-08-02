import { describe, it, expect } from 'vitest';
import { CARD_ENTRANCE_MAX_MS, frameAt, MORPH, MORPH_TOTAL, NAIL_Y } from '@/components/story/heroMorph';

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
