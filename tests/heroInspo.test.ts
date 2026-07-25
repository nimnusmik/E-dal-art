import { describe, it, expect } from 'vitest';
import { HERO_INSPO } from '@/components/story/heroInspo';

describe('HERO_INSPO', () => {
  it('컷은 4개다', () => {
    expect(HERO_INSPO).toHaveLength(4);
  });

  it('앵커(at)는 서로 겹치지 않는다', () => {
    const ats = HERO_INSPO.map((c) => c.at);
    expect(new Set(ats).size).toBe(ats.length);
  });

  it('번호(no)는 서로 겹치지 않는다', () => {
    const nos = HERO_INSPO.map((c) => c.no);
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('모든 src는 /hero/insp/ 아래 webp를 가리킨다', () => {
    for (const c of HERO_INSPO) {
      expect(c.src).toMatch(/^\/hero\/insp\/.+\.webp$/);
    }
  });

  it('모든 라벨은 비어 있지 않다', () => {
    for (const c of HERO_INSPO) expect(c.label.trim().length).toBeGreaterThan(0);
  });
});
