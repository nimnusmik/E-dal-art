import { describe, expect, it } from 'vitest';
import { currentIssue } from '@/lib/issue';

describe('currentIssue', () => {
  it('2026년 7월(KST)은 VOL.7', () => {
    const issue = currentIssue(new Date('2026-07-18T00:00:00+09:00'));
    expect(issue.vol).toBe(7);
    expect(issue.label).toBe('JULY 2026 — VOL.7');
  });

  it('2027년 1월은 VOL.13 (연도 이월)', () => {
    const issue = currentIssue(new Date('2027-01-05T12:00:00+09:00'));
    expect(issue.vol).toBe(13);
    expect(issue.monthLabel).toBe('JANUARY 2027');
  });

  it('KST 월 경계: UTC 6/30 16:00 = KST 7/1 01:00 → 7월호', () => {
    const issue = currentIssue(new Date('2026-06-30T16:00:00Z'));
    expect(issue.label).toBe('JULY 2026 — VOL.7');
  });

  it('KST 월 경계 직전: UTC 6/30 14:59 = KST 6/30 23:59 → 6월호', () => {
    const issue = currentIssue(new Date('2026-06-30T14:59:00Z'));
    expect(issue.vol).toBe(6);
  });

  it('2026년 이전은 VOL.1로 클램프', () => {
    expect(currentIssue(new Date('2025-11-01T00:00:00+09:00')).vol).toBe(1);
  });
});
