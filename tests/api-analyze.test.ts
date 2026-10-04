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
// 결제 게이트 통과용 — 실제 Stripe/DB를 건드리지 않는다
vi.mock('@/auth', () => ({ auth: vi.fn() }));
vi.mock('@/lib/payments', () => ({
  takeCredit: vi.fn(),
  refundCredit: vi.fn(),
}));
// 외부 API를 부르는 함수만 목킹 — applyOptions·fallbackPlans 등 순수 함수는 원본 사용
vi.mock('@/lib/brief', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/brief')>();
  return { ...original, analyzeToBrief: vi.fn(), planVariants: vi.fn() };
});

import { analyzeToBrief, planVariants, fallbackPlans, ZERO_PARTS_LINE } from '@/lib/brief';
import type { NailBrief } from '@/lib/brief';
import { POST } from '@/app/api/analyze/route';
import { auth } from '@/auth';
import { refundCredit, takeCredit } from '@/lib/payments';

const mockAuth = vi.mocked(auth);
const mockTakeCredit = vi.mocked(takeCredit);
const mockRefundCredit = vi.mocked(refundCredit);

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
  // 결제 게이트 통과: 로그인됨 + 차감 후 9회 남음
  mockAuth.mockResolvedValue({ user: { id: 'test-sub', email: 'test@example.com' } } as never);
  mockTakeCredit.mockReset().mockResolvedValue(9);
  mockRefundCredit.mockReset();
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
});

describe('POST /api/analyze', () => {
  it('성공: brief+plans(3개)+남은 횟수 반환, 쉐입·길이는 주문값 우선, 횟수권 1 차감', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.brief.shape).toBe('square');
    expect(json.brief.length).toBe('long');
    expect(json.plans).toHaveLength(3);
    expect(json.plans.map((p: { id: string }) => p.id)).toEqual(['v1', 'v2', 'v3']);
    expect(json.remaining).toBe(9); // 남은 횟수권
    expect(mockTakeCredit).toHaveBeenCalledWith('test-sub');
    expect(mockRefundCredit).not.toHaveBeenCalled();
    expect(typeof json.variantToken).toBe('string'); // variant 호출용 세션 토큰
    expect(store.data.get('quota:user:u:test-sub:' + kstToday())).toBe(1);
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
    store.data.set('quota:user:u:test-sub:' + kstToday(), 3);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_USER');
    expect(mockAnalyzeToBrief).not.toHaveBeenCalled();
    expect(mockRefundCredit).toHaveBeenCalledWith('test-sub'); // 막혔으니 횟수 환불
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
    expect(store.data.get('quota:user:u:test-sub:' + kstToday())).toBe(0); // 선점분 환불됨
    expect(mockRefundCredit).toHaveBeenCalledWith('test-sub'); // 횟수권도 환불
  });
});


function kstToday(): string {
  const kst = new Date(Date.now() + 9 * 3600 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

describe('결제 게이트', () => {
  it('미로그인 → 401 LOGIN_REQUIRED', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('LOGIN_REQUIRED');
    expect(mockAnalyzeToBrief).not.toHaveBeenCalled();
  });

  it('남은 횟수 없음 → 402 PAYMENT_REQUIRED', async () => {
    mockTakeCredit.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe('PAYMENT_REQUIRED');
    expect(mockAnalyzeToBrief).not.toHaveBeenCalled();
  });
});
