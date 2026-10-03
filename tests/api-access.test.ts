import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CounterStore } from '@/lib/quota';

const store = {
  data: new Map<string, number>(),
  reset() { this.data.clear(); },
};

const fakeStore: CounterStore = {
  async get(key) { return store.data.has(key) ? String(store.data.get(key)) : null; },
  async incr(key) { const n = (store.data.get(key) ?? 0) + 1; store.data.set(key, n); return n; },
  async decr(key) { const n = (store.data.get(key) ?? 0) - 1; store.data.set(key, n); return n; },
  async expire() {},
};

vi.mock('@/lib/redis', () => ({ getRedis: () => fakeStore }));
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/payments', () => ({
  isPaidBySub: vi.fn(),
  markPaid: vi.fn(),
  PRICE_REGULAR_KRW: 9900,
  PRICE_EARLY_KRW: 4900,
}));
// Stripe 키 없이도 돌아가야 한다 — 쿠폰 조회는 건너뛰고 earlyBirdLeft=null
vi.mock('@/lib/stripe', () => ({ getStripe: () => null }));

import { GET } from '@/app/api/access/route';
import { auth } from '@/auth';
import { isPaidBySub } from '@/lib/payments';

const mockAuth = vi.mocked(auth);
const mockIsPaid = vi.mocked(isPaidBySub);

beforeEach(() => {
  store.reset();
  mockAuth.mockResolvedValue({ user: { id: 'test-sub', email: 'test@example.com' } } as never);
  mockIsPaid.mockResolvedValue(false);
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
});

function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

describe('GET /api/access', () => {
  it('이용 상태 반환 (차감 없음)', async () => {
    store.data.set('quota:user:u:test-sub:' + kstToday(), 1);
    const res = await GET(new Request('http://localhost/api/access'));
    const json = await res.json();
    expect(json.paid).toBe(false);
    expect(json.remaining).toBe(2);
    expect(json.email).toBe('test@example.com');
    expect(json.priceRegular).toBe(9900);
    expect(json.priceEarly).toBe(4900);
    // 차감 없음
    expect(store.data.get('quota:user:u:test-sub:' + kstToday())).toBe(1);
  });

  it('결제한 계정은 paid=true', async () => {
    mockIsPaid.mockResolvedValue(true);
    const res = await GET(new Request('http://localhost/api/access'));
    expect((await res.json()).paid).toBe(true);
  });

  it('미로그인은 paid=false, email=null', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(new Request('http://localhost/api/access'));
    const json = await res.json();
    expect(json.paid).toBe(false);
    expect(json.email).toBe(null);
  });

  it('Stripe 없으면 earlyBirdLeft=null (얼리버드가를 보여주지 않는다)', async () => {
    const res = await GET(new Request('http://localhost/api/access'));
    expect((await res.json()).earlyBirdLeft).toBe(null);
  });
});
