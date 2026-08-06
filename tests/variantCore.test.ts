import { describe, it, expect } from 'vitest';
import { fallbackPlansForCore, isZeroParts, ZERO_PARTS_LINE } from '@/lib/brief';
import { coquette } from '@/config/cores/coquette';
import { decoden } from '@/config/cores/decoden';
import { nuance } from '@/config/cores/nuance';
import { textureGummy } from '@/config/cores/texture-gummy';
import type { NailCore } from '@/lib/core';

/** corePartsLine은 export하지 않으므로, zero-parts가 아닌 변주의 partsLine으로 우회 확인 */
function nonZeroPartsLineOf(core: NailCore): string {
  const plans = fallbackPlansForCore(core);
  const plan = plans.find((p) => p.partsLine !== ZERO_PARTS_LINE);
  if (!plan) throw new Error(`${core.id}: zero-parts가 아닌 플랜이 없음`);
  return plan.partsLine;
}

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

  it('다섯 플랜의 패턴 서술은 서로 다르다 — 4개 코어 전체', () => {
    for (const core of [coquette, nuance, textureGummy, decoden]) {
      const plans = fallbackPlansForCore(core);
      const joined = plans.map((p) => p.patternLines.join('|'));
      expect(new Set(joined).size, core.id).toBe(5);
    }
  });

  it('Fix1: 스터드 파츠 예산과 페인트 온리 팁이 서로 겹치지 않는다 (big>0 코어)', () => {
    for (const core of [decoden, coquette]) {
      const line = nonZeroPartsLineOf(core);
      // 예전 버그: "rest of the set"에 스터드를 준 다음 같은 문장에서 "remaining tip"을 페인트 온리로 못박음
      expect(line, core.id).not.toMatch(/rest of the set[\s\S]*remaining tip is painted gel only/i);
      // 배제 문구는 "파츠를 하나도 갖지 않는 팁"에만 적용돼야 한다
      expect(line, core.id).toMatch(/carries none of these|carries none of them/i);
    }
  });

  it('Fix1: big=0 코어(뉘앙스·텍스처거미)도 스터드 예산과 페인트 온리 팁이 겹치지 않는다', () => {
    for (const core of [nuance, textureGummy]) {
      const line = nonZeroPartsLineOf(core);
      expect(line, core.id).toMatch(/carries none of these|carries none of them/i);
    }
  });

  it('Fix2: isZeroParts는 뉘앙스·텍스처거미의 (0-2 스터드) 파츠라인을 파츠 제로로 오판하지 않는다', () => {
    for (const core of [nuance, textureGummy]) {
      const line = nonZeroPartsLineOf(core);
      expect(isZeroParts(line), core.id).toBe(false);
    }
    expect(isZeroParts(ZERO_PARTS_LINE)).toBe(true);
  });
});
