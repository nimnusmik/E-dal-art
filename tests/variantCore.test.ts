import { describe, it, expect } from 'vitest';
import { fallbackPlansForCore } from '@/lib/brief';
import { coquette } from '@/config/cores/coquette';
import { decoden } from '@/config/cores/decoden';
import { nuance } from '@/config/cores/nuance';

describe('fallbackPlansForCore', () => {
  it('코어마다 5개 플랜을 낸다', () => {
    for (const core of [coquette, decoden, nuance]) {
      const plans = fallbackPlansForCore(core);
      expect(plans, core.id).toHaveLength(5);
      expect(plans.map((p) => p.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    }
  });

  it('코케트에는 파츠 제로 변주가 있다', () => {
    const plans = fallbackPlansForCore(coquette);
    expect(plans.some((p) => p.partsLine.includes('painted gel only'))).toBe(true);
  });

  it('데코덴에는 파츠 제로 변주가 없다 — 정체성 파괴', () => {
    const plans = fallbackPlansForCore(decoden);
    expect(plans.every((p) => !p.partsLine.includes('Every tip is painted gel only'))).toBe(true);
  });

  it('뉘앙스에는 경계선 변주가 없다 — 경계선 자체를 배제하는 코어', () => {
    const plans = fallbackPlansForCore(nuance);
    const all = plans.flatMap((p) => p.patternLines).join(' ');
    expect(all).not.toMatch(/french boundary|smile line|diagonal boundary/i);
  });

  it('플랜 제목은 한국어', () => {
    for (const p of fallbackPlansForCore(decoden)) {
      expect(p.title).toMatch(/[가-힣]/);
    }
  });

  it('플랜 서술은 영어이고 금지 어휘가 없다', () => {
    for (const core of [coquette, decoden, nuance]) {
      const all = fallbackPlansForCore(core)
        .flatMap((p) => [...p.patternLines, p.partsLine])
        .join(' ');
      expect(all, core.id).not.toMatch(/[가-힣]/);
      expect(all, core.id).not.toMatch(/\bcharms?\b|\banchors?\b/i);
    }
  });

  it('다섯 플랜의 패턴 서술은 서로 다르다', () => {
    const plans = fallbackPlansForCore(decoden);
    const joined = plans.map((p) => p.patternLines.join('|'));
    expect(new Set(joined).size).toBe(5);
  });
});
