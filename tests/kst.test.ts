import { describe, it, expect } from 'vitest';
import { kstDateKey, secondsUntilKstMidnight } from '@/lib/kst';

describe('kstDateKey', () => {
  it('UTC 14:00 = KST 23:00 → 같은 날짜', () => {
    expect(kstDateKey(new Date('2026-07-07T14:00:00Z'))).toBe('20260707');
  });

  it('UTC 16:00 = KST 다음날 01:00 → 다음 날짜', () => {
    expect(kstDateKey(new Date('2026-07-07T16:00:00Z'))).toBe('20260708');
  });

  it('UTC 15:00 정각 = KST 자정 → 다음 날짜', () => {
    expect(kstDateKey(new Date('2026-07-07T15:00:00Z'))).toBe('20260708');
  });
});

describe('secondsUntilKstMidnight', () => {
  it('KST 23:59:00 → 60초', () => {
    expect(secondsUntilKstMidnight(new Date('2026-07-07T14:59:00Z'))).toBe(60);
  });

  it('KST 00:00:00 → 하루 전체 86400초', () => {
    expect(secondsUntilKstMidnight(new Date('2026-07-07T15:00:00Z'))).toBe(86400);
  });
});
