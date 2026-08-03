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
// 신규 파이프라인(브리프·검수)은 외부 API를 직접 부르므로 라우트 테스트에서는 목킹.
// 기본값: 브리프 실패(null) → 기존 레거시 경로가 그대로 동작해야 함 (기존 테스트 보존).
vi.mock('@/lib/brief', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/brief')>();
  return { ...original, analyzeToBrief: vi.fn() };
});
vi.mock('@/lib/judge', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/judge')>();
  return { ...original, generateJudged: vi.fn() };
});

import { callGemini } from '@/lib/gemini';
import { analyzeToBrief } from '@/lib/brief';
import { generateJudged } from '@/lib/judge';
import type { NailBrief } from '@/lib/brief';
import { POST, GET } from '@/app/api/generate/route';

const mockCallGemini = vi.mocked(callGemini);
const mockAnalyzeToBrief = vi.mocked(analyzeToBrief);
const mockGenerateJudged = vi.mocked(generateJudged);

const VALID_BRIEF: NailBrief = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'sheer milky nude base',
  structureLine: 'deep french tips',
  paletteLine: 'baby pink + baby blue',
  patternLines: ['polka dots'],
  textureLine: '',
  partsLine: 'Every tip is painted gel only — no metal, no gems, no pearls.',
  letteringWord: null,
  moodLine: 'coquette',
  keywords: ['코케트'],
  colors: ['#f5c8d7'],
  difficulty: 'medium',
  feasibilityNotes: '',
};

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
  mockAnalyzeToBrief.mockReset();
  mockAnalyzeToBrief.mockResolvedValue(null); // 기본: 브리프 실패 → 레거시 경로
  mockGenerateJudged.mockReset();
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
  delete process.env.IMAGE_PROVIDER; // 기본 gemini 경로 사용
});

describe('POST /api/generate', () => {
  it('신규 경로: 브리프 성공 시 검수 파이프라인의 통과작이 팁세트가 되고 tipSetQuality가 실린다', async () => {
    mockAnalyzeToBrief.mockResolvedValue(VALID_BRIEF);
    mockGenerateJudged.mockResolvedValue({
      best: { image: { data: 'anVkZ2Vk', mimeType: 'image/jpeg' }, judgement: null, pass: true, score: 6 },
      attempts: [],
    });
    mockCallGemini.mockResolvedValue(GEMINI_OK); // 히어로 생성
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tipSet).toEqual({ image: 'anVkZ2Vk', mimeType: 'image/jpeg' });
    expect(json.tipSetQuality).toEqual({ pass: true, score: 6 });
    // 쉐입·길이는 손님 주문이 브리프를 덮어씀
    const briefArg = mockGenerateJudged.mock.calls[0][1];
    expect(briefArg.shape).toBe('almond');
    expect(briefArg.length).toBe('short');
  });

  it('신규 경로: 검수 파이프라인이 빈손이면 레거시 팁 생성으로 폴백한다', async () => {
    mockAnalyzeToBrief.mockResolvedValue(VALID_BRIEF);
    mockGenerateJudged.mockResolvedValue({ best: null, attempts: [] });
    mockCallGemini.mockResolvedValue(GEMINI_OK); // 폴백 팁 + 히어로
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tipSet).toEqual({ image: 'cmVzdWx0', mimeType: 'image/png' });
    expect(json.tipSetQuality).toBeNull();
  });

  it('성공: 히어로+팁세트+무드+남은횟수 반환, 카운터 증가', async () => {
    mockCallGemini.mockResolvedValue(GEMINI_OK);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hero).toEqual({ image: 'cmVzdWx0', mimeType: 'image/png' });
    expect(json.tipSet).toEqual({ image: 'cmVzdWx0', mimeType: 'image/png' });
    expect(json.mood.keywords).toEqual(['몽환']);
    expect(mockCallGemini).toHaveBeenCalledTimes(2); // 히어로 + 팁세트
    expect(json.remaining).toBe(2);
  });

  it('팁세트만 실패해도 히어로 있으면 성공(tipSet=null), 1회 차감', async () => {
    // 생성 순서: 팁세트 먼저, 히어로 다음
    mockCallGemini
      .mockRejectedValueOnce(new Error('tip timeout')) // 팁세트 실패
      .mockResolvedValueOnce(GEMINI_OK); // 히어로 성공
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.hero.image).toBe('cmVzdWx0');
    expect(json.tipSet).toBeNull();
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
