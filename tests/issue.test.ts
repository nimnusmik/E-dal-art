import { describe, expect, it } from 'vitest';
import { currentIssue } from '@/lib/issue';

describe('currentIssue', () => {
  it('2026년 7월(KST)은 내부 vol 7, 라벨은 월만', () => {
    const issue = currentIssue(new Date('2026-07-18T00:00:00+09:00'));
    expect(issue.vol).toBe(7);
    expect(issue.label).toBe('JULY 2026');
    expect(issue.koLabel).toBe('2026년 7월 호');
    expect(issue.koShort).toBe('7월 호');
  });

  it('2027년 1월은 vol 13 (연도 이월)', () => {
    const issue = currentIssue(new Date('2027-01-05T12:00:00+09:00'));
    expect(issue.vol).toBe(13);
    expect(issue.monthLabel).toBe('JANUARY 2027');
    expect(issue.koLabel).toBe('2027년 1월 호');
  });

  it('KST 월 경계: UTC 6/30 16:00 = KST 7/1 01:00 → 7월호', () => {
    const issue = currentIssue(new Date('2026-06-30T16:00:00Z'));
    expect(issue.label).toBe('JULY 2026');
    expect(issue.koShort).toBe('7월 호');
  });

  it('KST 월 경계 직전: UTC 6/30 14:59 = KST 6/30 23:59 → 6월호', () => {
    const issue = currentIssue(new Date('2026-06-30T14:59:00Z'));
    expect(issue.vol).toBe(6);
    expect(issue.koShort).toBe('6월 호');
  });

  it('2026년 이전은 vol 1로 클램프', () => {
    expect(currentIssue(new Date('2025-11-01T00:00:00+09:00')).vol).toBe(1);
  });

  it('라벨에 VOL 표기가 남아 있지 않다 (가짜 발행 이력 방지)', () => {
    const issue = currentIssue(new Date('2026-08-06T00:00:00+09:00'));
    expect(issue.label).not.toMatch(/VOL/i);
    expect(issue.koLabel).not.toMatch(/VOL/i);
  });
});
