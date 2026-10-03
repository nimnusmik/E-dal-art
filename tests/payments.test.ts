import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * lib/payments 테스트 — DB는 목킹한다.
 * 실제 neon 클라이언트는 태그드 템플릿(sql`...`)이므로, 목도 같은 모양이다.
 */

let paidAtRows: Array<{ paid_at: string | null }> = [{ paid_at: '2026-10-03T00:00:00Z' }];
let shouldThrow = false;
let dbMissing = false;
const seenQueries: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSql: any = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (shouldThrow) throw new Error('db down');
  seenQueries.push(strings.join('?') + ' :: ' + JSON.stringify(values));
  if (strings[0].includes('select paid_at')) return paidAtRows;
  return [];
};

vi.mock('@/lib/db', () => ({
  getDb: () => (dbMissing ? null : mockSql),
}));

import { isPaidBySub, markPaid } from '@/lib/payments';

beforeEach(() => {
  paidAtRows = [{ paid_at: '2026-10-03T00:00:00Z' }];
  shouldThrow = false;
  dbMissing = false;
  seenQueries.length = 0;
});

describe('isPaidBySub', () => {
  it('paid_at이 있으면 true', async () => {
    expect(await isPaidBySub('sub-1')).toBe(true);
  });

  it('paid_at이 null이면 false', async () => {
    paidAtRows = [{ paid_at: null }];
    expect(await isPaidBySub('sub-1')).toBe(false);
  });

  it('행이 없으면 false', async () => {
    paidAtRows = [];
    expect(await isPaidBySub('sub-1')).toBe(false);
  });

  it('DB가 없으면 false (열린 쪽으로 실패하지 않는다)', async () => {
    dbMissing = true;
    expect(await isPaidBySub('sub-1')).toBe(false);
  });

  it('DB 에러면 false', async () => {
    shouldThrow = true;
    expect(await isPaidBySub('sub-1')).toBe(false);
  });
});

describe('markPaid', () => {
  it('이용권을 기록한다', async () => {
    const ok = await markPaid({
      googleSub: 'sub-1',
      email: 'a@b.co',
      customerId: 'cus_123',
      sessionId: 'cs_123',
    });
    expect(ok).toBe(true);
    expect(seenQueries.length).toBe(1);
    expect(seenQueries[0]).toContain('paid_at');
    expect(seenQueries[0]).toContain('sub-1');
  });

  it('DB가 없으면 false', async () => {
    dbMissing = true;
    expect(
      await markPaid({ googleSub: 's', email: 'e', customerId: 'c', sessionId: 'cs' }),
    ).toBe(false);
  });

  it('DB 에러면 false', async () => {
    shouldThrow = true;
    expect(
      await markPaid({ googleSub: 's', email: 'e', customerId: 'c', sessionId: 'cs' }),
    ).toBe(false);
  });
});
