import { describe, it, expect } from 'vitest';
import { allCores, getCore, UNIVERSAL_RULES } from '@/lib/core';

describe('코어 레지스트리', () => {
  it('없는 id는 null', () => {
    expect(getCore('nope')).toBeNull();
  });

  it('등록된 모든 코어를 id로 찾을 수 있다', () => {
    for (const core of allCores()) {
      expect(getCore(core.id), core.id).toBe(core);
    }
  });

  it('id는 중복되지 않는다', () => {
    const ids = allCores().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('공통분모 규칙은 4줄이고 모두 영어', () => {
    expect(UNIVERSAL_RULES).toHaveLength(4);
    for (const line of UNIVERSAL_RULES) {
      expect(line).not.toMatch(/[가-힣]/);
    }
  });

  it('모든 코어는 금지 어휘 charm·anchor를 프롬프트 문장에 쓰지 않는다', () => {
    for (const core of allCores()) {
      const text = [
        core.baseLine,
        core.finishMix,
        core.partsPhysics,
        ...core.textureGrammar,
        ...core.signature,
        ...core.forbidden,
        ...Object.values(core.designZone),
      ].join(' ');
      expect(text).not.toMatch(/\bcharms?\b|\banchors?\b/i);
    }
  });

  it('모든 코어의 모델 입력 문장에 한글이 섞이지 않는다', () => {
    for (const core of allCores()) {
      const text = [core.baseLine, core.finishMix, core.partsPhysics, ...core.signature].join(' ');
      expect(text, core.id).not.toMatch(/[가-힣]/);
    }
  });

  it('모든 코어는 사용자 노출 문자열을 한국어로 갖는다', () => {
    for (const core of allCores()) {
      expect(core.nameKo, core.id).toMatch(/[가-힣]/);
      expect(core.taglineKo, core.id).toMatch(/[가-힣]/);
    }
  });

  it('negativeSpace는 [min, max] 순서이고 0~1 범위', () => {
    for (const core of allCores()) {
      const [min, max] = core.negativeSpace;
      expect(min, core.id).toBeLessThanOrEqual(max);
      expect(min, core.id).toBeGreaterThanOrEqual(0);
      expect(max, core.id).toBeLessThanOrEqual(1);
    }
  });

  it('judge 파츠 범위는 min <= max', () => {
    for (const core of allCores()) {
      expect(core.judge.minPartsTips, core.id).toBeLessThanOrEqual(core.judge.maxPartsTips);
    }
  });

  it('코케트가 등록되어 있다', () => {
    expect(getCore('coquette')?.nameKo).toBe('코케트');
  });
});
