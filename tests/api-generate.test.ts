import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CounterStore } from '@/lib/quota';

const store = {
  data: new Map<string, number>(),
  reset() { this.data.clear(); },
};

const fakeStore: CounterStore = {
  async get(key) { return store.data.has(key) ? String(store.data.get(key)) : null; },
  async incr(key) { const n = (store.data.get(key) ?? 0) + 1; store.data.set(key, n); return n; },
  async expire() {},
};

vi.mock('@/lib/redis', () => ({ getRedis: () => fakeStore }));
vi.mock('@/lib/gemini', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/gemini')>();
  return { ...original, callGemini: vi.fn() };
});

import { callGemini } from '@/lib/gemini';
import { POST, GET } from '@/app/api/generate/route';

const mockCallGemini = vi.mocked(callGemini);

function makeRequest(body: unknown, ip = '1.2.3.4'): Request {
  return new Request('http://localhost/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  images: [{ data: 'aGVsbG8=', mimeType: 'image/jpeg' }],
  shape: 'almond',
  length: 'short',
};

const GEMINI_OK = {
  image: { data: 'cmVzdWx0', mimeType: 'image/png' },
  mood: { keywords: ['몽환'], colors: ['#eeeeee'] },
  safetyBlocked: false,
};

beforeEach(() => {
  store.reset();
  mockCallGemini.mockReset();
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
});

describe('POST /api/generate', () => {
  it('성공: 이미지+무드+남은횟수 반환, 카운터 증가', async () => {
    mockCallGemini.mockResolvedValue(GEMINI_OK);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.image).toBe('cmVzdWx0');
    expect(json.mood.keywords).toEqual(['몽환']);
    expect(json.remaining).toBe(2);
  });

  it('검증 실패: 사진 0장 → 400 INVALID_INPUT', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, images: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_INPUT');
  });

  it('검증 실패: 사진 4장 → 400', async () => {
    const images = Array.from({ length: 4 }, () => VALID_BODY.images[0]);
    const res = await POST(makeRequest({ ...VALID_BODY, images }));
    expect(res.status).toBe(400);
  });

  it('검증 실패: 잘못된 shape → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, shape: 'oval' }));
    expect(res.status).toBe(400);
  });

  it('개인 한도 소진 → 429 RATE_LIMIT_USER, Gemini 호출 안 함', async () => {
    store.data.set('quota:user:1.2.3.4:' + kstToday(), 3);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_USER');
    expect(mockCallGemini).not.toHaveBeenCalled();
  });

  it('전체 총량 소진 → 429 RATE_LIMIT_TOTAL', async () => {
    store.data.set('quota:total:' + kstToday(), 200);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_TOTAL');
  });

  it('안전 차단 → 422 REJECTED, 횟수 미차감', async () => {
    mockCallGemini.mockResolvedValue({ image: null, mood: null, safetyBlocked: true });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(422);
    expect(store.data.get('quota:user:1.2.3.4:' + kstToday())).toBeUndefined();
  });

  it('이미지 없이 응답 → 502 GENERATION_FAILED, 횟수 미차감', async () => {
    mockCallGemini.mockResolvedValue({ image: null, mood: null, safetyBlocked: false });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    expect(store.data.get('quota:user:1.2.3.4:' + kstToday())).toBeUndefined();
  });

  it('Gemini 예외 → 502 GENERATION_FAILED', async () => {
    mockCallGemini.mockRejectedValue(new Error('timeout'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });
});

describe('GET /api/generate', () => {
  it('남은 횟수 반환', async () => {
    store.data.set('quota:user:1.2.3.4:' + kstToday(), 1);
    const res = await GET(new Request('http://localhost/api/generate', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    }));
    expect((await res.json()).remaining).toBe(2);
  });
});

function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}
