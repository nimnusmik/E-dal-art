import { describe, it, expect } from 'vitest';
import { coreExpectedParts, verdictForCore, parseCoreJudgement } from '@/lib/judge';
import type { CoreJudgement } from '@/lib/judge';
import { coquette } from '@/config/cores/coquette';
import { decoden } from '@/config/cores/decoden';
import { textureGummy } from '@/config/cores/texture-gummy';

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
};

describe('coreExpectedParts', () => {
  it('코어 judge 값을 그대로 읽는다 (문자열 파싱 없음)', () => {
    expect(coreExpectedParts(coquette)).toEqual({ min: 1, max: 2 });
    expect(coreExpectedParts(decoden)).toEqual({ min: 4, max: 10 });
  });
});

describe('verdictForCore', () => {
  it('전부 충족하면 통과, 만점', () => {
    const v = verdictForCore(CLEAN, coquette, 2);
    expect(v.pass).toBe(true);
    expect(v.score).toBe(8);
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
    expect(v.score).toBe(7);
  });

  it('모티프 충실도는 앵커 개수 대비로 점수에 반영된다', () => {
    const full = verdictForCore(CLEAN, coquette, 2);
    const half = verdictForCore({ ...CLEAN, motifFidelity: 0 }, coquette, 2);
    expect(half.score).toBeLessThan(full.score);
  });

  it('앵커가 0개면 모티프 충실도는 만족으로 본다', () => {
    const v = verdictForCore({ ...CLEAN, motifFidelity: 0 }, coquette, 0);
    expect(v.score).toBe(8);
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
  });

  it('젤 볼륨을 허용하지 않는 코어는 볼륨 부재로 감점되지 않는다', () => {
    const withVolume = verdictForCore({ ...CLEAN, raisedVolumeObserved: true }, coquette, 2);
    const withoutVolume = verdictForCore({ ...CLEAN, raisedVolumeObserved: false }, coquette, 2);
    expect(withoutVolume.score).toBe(withVolume.score);
    expect(withoutVolume.score).toBe(8);
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
});
