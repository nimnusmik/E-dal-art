import { describe, it, expect } from 'vitest';
import { coreExpectedParts, verdictForCore, parseCoreJudgement } from '@/lib/judge';
import type { CoreJudgement } from '@/lib/judge';
import { coquette } from '@/config/cores/coquette';
import { nuance } from '@/config/cores/nuance';
import { decoden } from '@/config/cores/decoden';
import { textureGummy } from '@/config/cores/texture-gummy';

// bareSurfaceShare 0.1은 4개 코어 전부의 negativeSpace[1]+tolerance(0.15) 상한보다
// 낮으므로(가장 낮은 상한은 decoden의 0.15+0.15=0.3) 어느 코어에서 써도 항상 통과한다.
const CLEAN: CoreJudgement = {
  baseMatch: true,
  paletteMatch: true,
  partsMatch: true,
  metalTipCount: 1,
  letteringCount: 0,
  physicsOk: true,
  cleanRender: true,
  notes: '',
  paletteFidelity: true,
  motifFidelity: 2,
  coreFidelity: true,
  raisedVolumeObserved: true,
  finishVarietyObserved: true,
  bareSurfaceShare: 0.1,
};

describe('coreExpectedParts', () => {
  it('코어 judge 값을 그대로 읽는다 (문자열 파싱 없음)', () => {
    expect(coreExpectedParts(coquette)).toEqual({ min: 1, max: 2 });
    expect(coreExpectedParts(decoden)).toEqual({ min: 4, max: 10 });
  });
});

describe('verdictForCore', () => {
  it('전부 충족하면 통과, 만점 (maxScore와 score가 같다)', () => {
    const v = verdictForCore(CLEAN, coquette, 2);
    expect(v.pass).toBe(true);
    // 코케트: requiresGelVolume/expectsFinishVariety 둘 다 false → 기본 8체크 + bare 1체크 = 9
    expect(v.maxScore).toBe(9);
    expect(v.score).toBe(9);
  });

  it('파츠 개수가 코어 범위를 벗어나면 탈락', () => {
    const v = verdictForCore({ ...CLEAN, metalTipCount: 7 }, coquette, 2);
    expect(v.pass).toBe(false);
  });

  it('같은 파츠 개수가 데코덴에서는 통과한다', () => {
    const v = verdictForCore({ ...CLEAN, metalTipCount: 7 }, decoden, 2);
    expect(v.pass).toBe(true);
  });

  it('물리 위반은 즉시 탈락', () => {
    expect(verdictForCore({ ...CLEAN, physicsOk: false }, coquette, 2).pass).toBe(false);
  });

  it('AI 티는 즉시 탈락', () => {
    expect(verdictForCore({ ...CLEAN, cleanRender: false }, coquette, 2).pass).toBe(false);
  });

  it('코어 충실도 실패는 점수만 깎고 탈락시키지 않는다 (D8)', () => {
    const v = verdictForCore({ ...CLEAN, coreFidelity: false }, coquette, 2);
    expect(v.pass).toBe(true);
    expect(v.score).toBe(8);
    expect(v.maxScore).toBe(9);
  });

  it('모티프 충실도는 앵커 개수 대비로 점수에 반영된다', () => {
    const full = verdictForCore(CLEAN, coquette, 2);
    const half = verdictForCore({ ...CLEAN, motifFidelity: 0 }, coquette, 2);
    expect(half.score).toBeLessThan(full.score);
  });

  it('앵커가 0개면 모티프 충실도는 만족으로 본다', () => {
    const v = verdictForCore({ ...CLEAN, motifFidelity: 0 }, coquette, 0);
    expect(v.score).toBe(9);
    expect(v.maxScore).toBe(9);
  });

  it('구미 코어에서 텍스처 없는 밋밋한 세트가 텍스처 있는 세트보다 낮은 점수를 받는다', () => {
    const GUMMY_BASE: CoreJudgement = { ...CLEAN, metalTipCount: 1 };
    const timid = verdictForCore(
      { ...GUMMY_BASE, raisedVolumeObserved: false, finishVarietyObserved: false, bareSurfaceShare: 0.1 },
      textureGummy,
      0,
    );
    const textured = verdictForCore(
      { ...GUMMY_BASE, raisedVolumeObserved: true, finishVarietyObserved: true, bareSurfaceShare: 0.1 },
      textureGummy,
      0,
    );
    expect(timid.score).toBeLessThan(textured.score);
    // 텍스처·구미는 requiresGelVolume/expectsFinishVariety 둘 다 true → 8 + 1 + 1 + 1(bare) = 11
    expect(timid.maxScore).toBe(11);
    expect(textured.maxScore).toBe(11);
    expect(textured.score).toBe(11);
  });

  it('젤 볼륨을 요구하지 않는 코어는 볼륨 부재로 감점되지 않는다', () => {
    const withVolume = verdictForCore({ ...CLEAN, raisedVolumeObserved: true }, coquette, 2);
    const withoutVolume = verdictForCore({ ...CLEAN, raisedVolumeObserved: false }, coquette, 2);
    expect(withoutVolume.score).toBe(withVolume.score);
    expect(withoutVolume.score).toBe(9);
  });

  it('데코덴에서 미장식 비율이 높으면 감점된다 (파츠 개수만으론 못 잡던 사례)', () => {
    const dense = verdictForCore(
      { ...CLEAN, metalTipCount: 5, bareSurfaceShare: 0.05, raisedVolumeObserved: true, finishVarietyObserved: true },
      decoden,
      2,
    );
    const bare = verdictForCore(
      { ...CLEAN, metalTipCount: 5, bareSurfaceShare: 0.6, raisedVolumeObserved: true, finishVarietyObserved: true },
      decoden,
      2,
    );
    expect(bare.score).toBeLessThan(dense.score);
    expect(bare.pass).toBe(true); // 재생성 없음 — 점수만 깎고 탈락시키지 않는다
  });

  describe('nuance 코어', () => {
    it('전부 충족하면 통과, 만점 — allowGelVolume/finishVariety 둘 다 없어 코케트와 같은 스케일', () => {
      const v = verdictForCore(CLEAN, nuance, 1);
      expect(v.pass).toBe(true);
      expect(v.maxScore).toBe(9);
      expect(v.score).toBe(9);
    });

    it('파츠 개수가 뉘앙스 범위(0~2)를 벗어나면 탈락', () => {
      const v = verdictForCore({ ...CLEAN, metalTipCount: 5 }, nuance, 1);
      expect(v.pass).toBe(false);
    });

    it('파츠 0개는 뉘앙스에서 통과한다 (min이 0)', () => {
      const v = verdictForCore({ ...CLEAN, metalTipCount: 0 }, nuance, 1);
      expect(v.pass).toBe(true);
    });
  });

  describe('bareSurfaceShare 허용치 경계값', () => {
    it('코케트: negativeSpace 상한(0.7) + tolerance(0.15) = 0.85 경계에서 통과, 그 위에서 감점', () => {
      const atBoundary = verdictForCore({ ...CLEAN, bareSurfaceShare: 0.85 }, coquette, 2);
      const overBoundary = verdictForCore({ ...CLEAN, bareSurfaceShare: 0.86 }, coquette, 2);
      expect(atBoundary.score).toBe(9);
      expect(overBoundary.score).toBe(8);
      // 어느 쪽도 pass를 좌우하지 않는다 — bareSurfaceShare는 절대 게이트가 아니다
      expect(atBoundary.pass).toBe(true);
      expect(overBoundary.pass).toBe(true);
    });

    it('데코덴: negativeSpace 상한(0.15) + tolerance(0.15) = 0.3 경계에서 통과, 그 위에서 감점', () => {
      const atBoundary = verdictForCore(
        { ...CLEAN, metalTipCount: 5, bareSurfaceShare: 0.3 },
        decoden,
        2,
      );
      const overBoundary = verdictForCore(
        { ...CLEAN, metalTipCount: 5, bareSurfaceShare: 0.31 },
        decoden,
        2,
      );
      expect(atBoundary.score).toBeGreaterThan(overBoundary.score);
      expect(atBoundary.pass).toBe(true);
      expect(overBoundary.pass).toBe(true);
    });
  });
});

describe('parseCoreJudgement', () => {
  it('신규 관찰 필드 3개를 포함해 파싱한다', () => {
    const json = JSON.stringify({
      baseMatch: true,
      paletteMatch: true,
      partsMatch: true,
      metalTipCount: 5,
      letteringCount: 0,
      physicsOk: true,
      cleanRender: true,
      notes: '',
      paletteFidelity: true,
      motifFidelity: 2,
      coreFidelity: true,
      raisedVolumeObserved: true,
      finishVarietyObserved: false,
      bareSurfaceShare: 0.2,
    });
    const parsed = parseCoreJudgement(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.raisedVolumeObserved).toBe(true);
    expect(parsed?.finishVarietyObserved).toBe(false);
    expect(parsed?.bareSurfaceShare).toBe(0.2);
  });

  it('필수 충실도 필드가 없으면 null', () => {
    expect(parseCoreJudgement('{}')).toBeNull();
  });

  it('관찰 필드가 존재하지만 타입이 틀리면 null (Fix 7 — 결측과 오답을 구분해도 오답은 항상 거부)', () => {
    const wrongType = JSON.stringify({
      baseMatch: true,
      paletteMatch: true,
      partsMatch: true,
      metalTipCount: 5,
      letteringCount: 0,
      physicsOk: true,
      cleanRender: true,
      notes: '',
      paletteFidelity: true,
      motifFidelity: 2,
      coreFidelity: true,
      raisedVolumeObserved: 'yes', // boolean이어야 하는데 string
      finishVarietyObserved: false,
      bareSurfaceShare: 0.2,
    });
    expect(parseCoreJudgement(wrongType)).toBeNull();
  });

  it('bareSurfaceShare가 문자열이면 null', () => {
    const wrongType = JSON.stringify({
      baseMatch: true,
      paletteMatch: true,
      partsMatch: true,
      metalTipCount: 5,
      letteringCount: 0,
      physicsOk: true,
      cleanRender: true,
      notes: '',
      paletteFidelity: true,
      motifFidelity: 2,
      coreFidelity: true,
      raisedVolumeObserved: true,
      finishVarietyObserved: false,
      bareSurfaceShare: '0.2', // number여야 하는데 string
    });
    expect(parseCoreJudgement(wrongType)).toBeNull();
  });
});
