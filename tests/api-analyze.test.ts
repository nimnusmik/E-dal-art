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
// 외부 API를 부르는 함수만 목킹 — applyOptions·fallbackPlans 등 순수 함수는 원본 사용
vi.mock('@/lib/brief', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/brief')>();
  return { ...original, analyzeToBrief: vi.fn(), planVariants: vi.fn() };
});

import { analyzeToBrief, planVariants, fallbackPlans, ZERO_PARTS_LINE } from '@/lib/brief';
import type { NailBrief } from '@/lib/brief';
import { POST, GET } from '@/app/api/analyze/route';

const mockAnalyzeToBrief = vi.mocked(analyzeToBrief);
const mockPlanVariants = vi.mocked(planVariants);

const VALID_BRIEF: NailBrief = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'sheer milky nude base',
  structureLine: 'deep french tips',
  paletteLine: 'baby pink + baby blue',
  patternLines: ['polka dots'],
  textureLine: '',
  partsLine:
    'Exactly one tip carries a single small pearl on its french boundary line. Every other tip is painted gel only — no metal, no gems, no pearls.',
  letteringWord: null,
  moodLine: 'coquette',
  keywords: ['코케트'],
  colors: ['#f5c8d7'],
  difficulty: 'medium',
  feasibilityNotes: '',
};

function makeRequest(body: unknown, ip = '1.2.3.4'): Request {
  return new Request('http://localhost/api/analyze', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  images: [{ data: 'aGVsbG8=', mimeType: 'image/jpeg' }],
  shape: 'square',
  length: 'long',
  partsIntensity: 'auto',
};

beforeEach(() => {
  store.reset();
  mockAnalyzeToBrief.mockReset();
  mockPlanVariants.mockReset();
  mockAnalyzeToBrief.mockResolvedValue(VALID_BRIEF);
  mockPlanVariants.mockImplementation(async (brief) => fallbackPlans(brief));
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
});

describe('POST /api/analyze', () => {
  it('성공: brief+plans(5개)+remaining 반환, 쉐입·길이는 주문값 우선, 크레딧 1 차감', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.brief.shape).toBe('square');
    expect(json.brief.length).toBe('long');
    expect(json.plans).toHaveLength(5);
    expect(json.plans.map((p: { id: string }) => p.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    expect(json.remaining).toBe(2);
    expect(store.data.get('quota:user:ip:1.2.3.4:' + kstToday())).toBe(1);
  });

  it('partsIntensity=none이면 브리프 partsLine이 파츠 제로 문장으로 교체된다', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, partsIntensity: 'none' }));
    const json = await res.json();
    expect(json.brief.partsLine).toBe(ZERO_PARTS_LINE);
  });

  it('검증 실패: 잘못된 partsIntensity → 400 INVALID_INPUT', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, partsIntensity: 'max' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_INPUT');
  });

  it('검증 실패: 사진 0장 → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, images: [] }));
    expect(res.status).toBe(400);
  });

  it('개인 한도 소진 → 429 RATE_LIMIT_USER, 분석 호출 안 함', async () => {
    store.data.set('quota:user:ip:1.2.3.4:' + kstToday(), 3);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_USER');
    expect(mockAnalyzeToBrief).not.toHaveBeenCalled();
  });

  it('전체 총량 소진 → 429 RATE_LIMIT_TOTAL', async () => {
    store.data.set('quota:total:' + kstToday(), 200);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_TOTAL');
  });

  it('분석 실패 → 502 ANALYZE_FAILED, 크레딧 미차감', async () => {
    mockAnalyzeToBrief.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('ANALYZE_FAILED');
    expect(store.data.get('quota:user:ip:1.2.3.4:' + kstToday())).toBe(0); // 선점분 환불됨
  });
});

describe('GET /api/analyze', () => {
  it('남은 횟수 반환 (차감 없음)', async () => {
    store.data.set('quota:user:ip:1.2.3.4:' + kstToday(), 1);
    const res = await GET(new Request('http://localhost/api/analyze', {
      headers: { 'x-forwarded-for': '1.2.3.4' },
    }));
    expect((await res.json()).remaining).toBe(2);
    expect(store.data.get('quota:user:ip:1.2.3.4:' + kstToday())).toBe(1);
  });
});

function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}
