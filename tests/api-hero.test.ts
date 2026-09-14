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
vi.mock('@/lib/provider', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/provider')>();
  return { ...original, generateImage: vi.fn() };
});

import { generateImage } from '@/lib/provider';
import { POST } from '@/app/api/hero/route';

const mockGenerateImage = vi.mocked(generateImage);

const GEN_OK = {
  image: { data: 'aGVybw==', mimeType: 'image/png' },
  mood: null,
  safetyBlocked: false,
};

function makeRequest(body: unknown, ip = '1.2.3.4'): Request {
  return new Request('http://localhost/api/hero', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  images: [{ data: 'aGVsbG8=', mimeType: 'image/jpeg' }],
  tipSet: { image: 'dGlwc2V0', mimeType: 'image/png' },
  shape: 'almond',
  length: 'short',
};

function heroKey(): string {
  return 'quota:hero:1.2.3.4:' + kstToday();
}

beforeEach(() => {
  store.reset();
  mockGenerateImage.mockReset();
  mockGenerateImage.mockResolvedValue(GEN_OK);
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
});

describe('POST /api/hero', () => {
  it('성공: 착용샷 반환, hero 카운터 1 증가', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hero).toEqual({ image: 'aGVybw==', mimeType: 'image/png' });
    expect(store.data.get(heroKey())).toBe(1);
  });

  it('팁셋 이미지를 참조로 추가하고 hasTipReference 프롬프트를 쓴다', async () => {
    await POST(makeRequest(VALID_BODY));
    const [refs, prompt] = mockGenerateImage.mock.calls[0];
    expect(refs).toHaveLength(2); // 영감 1장 + 팁셋 1장
    expect(refs[1]).toEqual({ data: 'dGlwc2V0', mimeType: 'image/png' });
    // buildPrompt(hasTipReference=true) 경로 확인 — 팁셋 복제 지시문 포함
    expect(prompt).toContain('flat-lay SET of finished nail tip designs');
  });

  it('검증 실패: tipSet 없음 → 400 INVALID_INPUT', async () => {
    const { tipSet: _omit, ...rest } = VALID_BODY;
    const res = await POST(makeRequest(rest));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_INPUT');
  });

  it('검증 실패: 잘못된 shape → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, shape: 'oval' }));
    expect(res.status).toBe(400);
  });

  it('hero 한도(DAILY_USER_LIMIT×5) 소진 → 429 RATE_LIMIT_HERO, 생성 호출 안 함', async () => {
    store.data.set(heroKey(), 15); // 3 × 5
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_HERO');
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('전역 이미지 한도 소진 → 429, IP를 바꿔도 통과 못 한다', async () => {
    store.data.set('quota:image:' + kstToday(), 200); // DAILY_IMAGE_LIMIT 기본값
    const res = await POST(makeRequest(VALID_BODY, '9.9.9.9'));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_TOTAL');
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('variant와 같은 전역 카운터를 공유한다 — 성공 시 1 증가', async () => {
    await POST(makeRequest(VALID_BODY));
    expect(store.data.get('quota:image:' + kstToday())).toBe(1);
  });

  it('안전 차단 → 422 REJECTED, 카운터 미차감', async () => {
    mockGenerateImage.mockResolvedValue({ image: null, mood: null, safetyBlocked: true });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(422);
    expect(store.data.get(heroKey())).toBe(0); // 선점분 환불됨
  });

  it('이미지 없이 응답 → 502 GENERATION_FAILED, 카운터 미차감', async () => {
    mockGenerateImage.mockResolvedValue({ image: null, mood: null, safetyBlocked: false });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    expect(store.data.get(heroKey())).toBe(0); // 선점분 환불됨
  });

  it('생성 예외 → 502 GENERATION_FAILED', async () => {
    mockGenerateImage.mockRejectedValue(new Error('timeout'));
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
  });
});

function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}
