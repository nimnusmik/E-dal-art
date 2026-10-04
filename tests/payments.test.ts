import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * lib/payments 테스트 — DB는 목킹한다.
 * 실제 neon 클라이언트는 태그드 템플릿(sql`...`)이므로, 목도 같은 모양이다.
 */

let rows: unknown[] = [];
let shouldThrow = false;
let dbMissing = false;
const seenQueries: string[] = [];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSql: any = async (strings: TemplateStringsArray, ...values: unknown[]) => {
  if (shouldThrow) throw new Error('db down');
  seenQueries.push(strings.join('?') + ' :: ' + JSON.stringify(values));
  return rows;
};
mockSql.transaction = async (queries: Promise<unknown>[]) => Promise.all(queries);

vi.mock('@/lib/db', () => ({
  getDb: () => (dbMissing ? null : mockSql),
}));

import { PACK_CREDITS, creditsBySub, markPaid, takeCredit } from '@/lib/payments';

beforeEach(() => {
  rows = [];
  shouldThrow = false;
  dbMissing = false;
  seenQueries.length = 0;
});

describe('creditsBySub', () => {
  it('남은 횟수를 돌려준다', async () => {
    rows = [{ credits: 7 }];
    expect(await creditsBySub('sub-1')).toBe(7);
  });

  it('행이 없거나 DB가 없거나 에러면 0 (열린 쪽으로 실패하지 않는다)', async () => {
    expect(await creditsBySub('sub-1')).toBe(0);
    dbMissing = true;
    expect(await creditsBySub('sub-1')).toBe(0);
    dbMissing = false;
    shouldThrow = true;
    expect(await creditsBySub('sub-1')).toBe(0);
  });
});

describe('takeCredit', () => {
  it('차감 후 남은 횟수, 조건부 update(credits > 0)로 원자적으로 뺀다', async () => {
    rows = [{ credits: 4 }];
    expect(await takeCredit('sub-1')).toBe(4);
    expect(seenQueries[0]).toContain('credits > 0');
  });

  it('남은 횟수가 없으면(갱신된 행 없음) null', async () => {
    expect(await takeCredit('sub-1')).toBe(null);
  });

  it('DB 에러면 null — 차감 못 하면 생성도 못 한다', async () => {
    shouldThrow = true;
    expect(await takeCredit('sub-1')).toBe(null);
  });
});

describe('markPaid', () => {
  it('거래 id를 payments 기본키로 넣고 그때만 PACK_CREDITS를 더한다', async () => {
    const ok = await markPaid({ googleSub: 'sub-1', email: 'a@b.co', paymentRef: 'txn_123' });
    expect(ok).toBe(true);
    expect(seenQueries).toHaveLength(2);
    expect(seenQueries[1]).toContain('on conflict (payment_ref) do nothing');
    expect(seenQueries[1]).toContain('txn_123');
    expect(seenQueries[1]).toContain(String(PACK_CREDITS));
  });

  it('DB가 없으면 false', async () => {
    dbMissing = true;
    expect(await markPaid({ googleSub: 's', email: 'e', paymentRef: 'txn' })).toBe(false);
  });

  it('DB 에러면 false', async () => {
    shouldThrow = true;
    expect(await markPaid({ googleSub: 's', email: 'e', paymentRef: 'txn' })).toBe(false);
  });
});
