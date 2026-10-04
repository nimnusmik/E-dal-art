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
vi.mock('@/lib/payments', () => ({ creditsBySub: vi.fn() }));

import { GET } from '@/app/api/access/route';
import { auth } from '@/auth';
import { creditsBySub } from '@/lib/payments';

const mockAuth = vi.mocked(auth);
const mockCredits = vi.mocked(creditsBySub);

beforeEach(() => {
  store.reset();
  mockAuth.mockResolvedValue({ user: { id: 'test-sub', email: 'test@example.com' } } as never);
  mockCredits.mockResolvedValue(0);
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
    expect(json.remaining).toBe(0); // 남은 횟수권
    expect(json.email).toBe('test@example.com');
    // 차감 없음
    expect(store.data.get('quota:user:u:test-sub:' + kstToday())).toBe(1);
  });

  it('횟수가 남은 계정은 paid=true, remaining=남은 횟수', async () => {
    mockCredits.mockResolvedValue(7);
    const res = await GET(new Request('http://localhost/api/access'));
    const json = await res.json();
    expect(json.paid).toBe(true);
    expect(json.remaining).toBe(7);
  });

  it('미로그인은 paid=false, email=null', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await GET(new Request('http://localhost/api/access'));
    const json = await res.json();
    expect(json.paid).toBe(false);
    expect(json.email).toBe(null);
  });
});
