import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CounterStore } from '@/lib/quota';

const data = new Map<string, number>();
const fakeStore: CounterStore = {
  async get(key) { return data.has(key) ? String(data.get(key)) : null; },
  async incr(key) { const n = (data.get(key) ?? 0) + 1; data.set(key, n); return n; },
  async expire() {},
};

vi.mock('@/lib/redis', () => ({ getRedis: () => fakeStore }));

import { POST } from '@/app/api/track/route';

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => data.clear());

describe('POST /api/track', () => {
  it('save 이벤트 카운트', async () => {
    const res = await POST(makeRequest({ event: 'save' }));
    expect(res.status).toBe(200);
    const key = [...data.keys()].find((k) => k.startsWith('metric:save:'));
    expect(key).toBeDefined();
    expect(data.get(key!)).toBe(1);
  });

  it('evolve 이벤트 카운트', async () => {
    const res = await POST(makeRequest({ event: 'evolve' }));
    expect(res.status).toBe(200);
  });

  it('알 수 없는 이벤트 → 400', async () => {
    const res = await POST(makeRequest({ event: 'hack' }));
    expect(res.status).toBe(400);
  });
});
