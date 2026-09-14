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
// 검수기(vision 호출)만 목킹 — verdict 등 순수 함수는 원본 사용
vi.mock('@/lib/judge', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/judge')>();
  return { ...original, judgeImage: vi.fn() };
});

import { generateImage } from '@/lib/provider';
import { judgeImage } from '@/lib/judge';
import type { NailJudgement } from '@/lib/judge';
import type { NailBrief } from '@/lib/brief';
import type { VariantPlan } from '@/lib/types';
import { POST } from '@/app/api/variant/route';

const mockGenerateImage = vi.mocked(generateImage);
const mockJudgeImage = vi.mocked(judgeImage);

const VALID_BRIEF: NailBrief = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'sheer milky nude base',
  structureLine: 'deep french tips',
  paletteLine: 'baby pink + baby blue',
  patternLines: ['polka dots'],
  textureLine: '',
  partsLine: 'Every tip is painted gel only — no metal, no gems, no pearls, no 3D parts.',
  letteringWord: null,
  moodLine: 'coquette',
  keywords: ['코케트'],
  colors: ['#f5c8d7'],
  difficulty: 'medium',
  feasibilityNotes: '',
};

const VALID_PLAN: VariantPlan = {
  id: 'v2',
  title: '컬러 반전',
  patternLines: ['Invert figure and ground on every tip.'],
  partsLine: 'Every tip is painted gel only — no metal, no gems, no pearls, no 3D parts.',
  letteringWord: null,
};

const CLEAN_JUDGEMENT: NailJudgement = {
  baseMatch: true,
  paletteMatch: true,
  partsMatch: true,
  metalTipCount: 0,
  letteringCount: 0,
  physicsOk: true,
  cleanRender: true,
  notes: '통과',
};

const GEN_OK = {
  image: { data: 'cmVzdWx0', mimeType: 'image/png' },
  mood: null,
  safetyBlocked: false,
};

function makeRequest(body: unknown, ip = '1.2.3.4'): Request {
  return new Request('http://localhost/api/variant', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': `${ip}, 10.0.0.1` },
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  images: [{ data: 'aGVsbG8=', mimeType: 'image/jpeg' }],
  brief: VALID_BRIEF,
  plan: VALID_PLAN,
};

function variantKey(): string {
  return 'quota:variant:1.2.3.4:' + kstToday();
}

beforeEach(() => {
  store.reset();
  mockGenerateImage.mockReset();
  mockJudgeImage.mockReset();
  mockGenerateImage.mockResolvedValue(GEN_OK);
  mockJudgeImage.mockResolvedValue(CLEAN_JUDGEMENT);
  process.env.DAILY_USER_LIMIT = '3';
  process.env.DAILY_TOTAL_LIMIT = '200';
});

describe('POST /api/variant', () => {
  it('성공: 팁셋 1장 + 검수 결과 반환, variant 카운터 1 증가', async () => {
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.tipSet).toEqual({ image: 'cmVzdWx0', mimeType: 'image/png' });
    // 배지 하나가 아니라 근거까지 — 심사평·미달 항목이 UI로 나가야 "왜"를 말할 수 있다
    expect(json.quality).toEqual({
      pass: true,
      score: 6,
      maxScore: 6,
      notes: '통과',
      issues: [],
    });
    expect(store.data.get(variantKey())).toBe(1);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1); // variant당 재시도 없음
  });

  it('플랜이 브리프에 병합된 프롬프트로 생성한다 (플랜 패턴·파츠 반영)', async () => {
    await POST(makeRequest(VALID_BODY));
    const prompt = mockGenerateImage.mock.calls[0][1];
    expect(prompt).toContain(VALID_PLAN.patternLines[0]);
    expect(prompt).toContain(VALID_PLAN.partsLine);
  });

  it('낙제작도 반환한다 — quality.pass=false 표시만 (422 아님)', async () => {
    mockJudgeImage.mockResolvedValue({ ...CLEAN_JUDGEMENT, physicsOk: false });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).quality.pass).toBe(false);
  });

  it('검수 호출 실패(null)면 quality=null로 반환한다', async () => {
    mockJudgeImage.mockResolvedValue(null);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).quality).toBeNull();
  });

  it('검증 실패: 플랜에 partsLine 없음 → 400 INVALID_INPUT', async () => {
    const { partsLine: _omit, ...planRest } = VALID_PLAN;
    const res = await POST(makeRequest({ ...VALID_BODY, plan: planRest }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('INVALID_INPUT');
  });

  it('검증 실패: 브리프 shape이 잘못됨 → 400', async () => {
    const res = await POST(makeRequest({ ...VALID_BODY, brief: { ...VALID_BRIEF, shape: 'octagon' } }));
    expect(res.status).toBe(400);
  });

  it('variant 한도(DAILY_USER_LIMIT×6) 소진 → 429 RATE_LIMIT_VARIANT, 생성 호출 안 함', async () => {
    store.data.set(variantKey(), 18); // 3 × 6
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_VARIANT');
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('전역 이미지 한도 소진 → 429, IP를 바꿔도 통과 못 한다', async () => {
    // IP별 한도만 있으면 IP를 갈아끼우는 만큼 비용이 선형으로 늘어난다.
    // 전역 카운터가 "우회당해도 하루 상한은 고정"을 만드는 지점.
    store.data.set('quota:image:' + kstToday(), 200); // DAILY_IMAGE_LIMIT 기본값
    const res = await POST(makeRequest(VALID_BODY, '9.9.9.9'));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_TOTAL');
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('전역 한도에 걸리면 IP별 카운터는 되돌린다 (억울한 차감 없음)', async () => {
    store.data.set('quota:image:' + kstToday(), 200);
    await POST(makeRequest(VALID_BODY));
    expect(store.data.get(variantKey())).toBe(0);
  });

  it('성공하면 전역 이미지 카운터도 1 증가한다', async () => {
    await POST(makeRequest(VALID_BODY));
    expect(store.data.get('quota:image:' + kstToday())).toBe(1);
  });

  it('동시 요청이 variant 한도를 넘기지 못한다', async () => {
    // 기존 "조회 → 생성(수십 초) → 차감"에서는 잔여 1회로 동시 요청이 전부 통과했다
    const results = await Promise.all(
      Array.from({ length: 25 }, () => POST(makeRequest(VALID_BODY))),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(18); // 3 × 6
    expect(store.data.get(variantKey())).toBe(18);
  });

  it('안전 차단 → 422 REJECTED, 카운터 미차감', async () => {
    mockGenerateImage.mockResolvedValue({ image: null, mood: null, safetyBlocked: true });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toBe('REJECTED');
    expect(store.data.get(variantKey())).toBe(0); // 선점분 환불됨
  });

  it('이미지 없이 응답 → 502 GENERATION_FAILED, 카운터 미차감', async () => {
    mockGenerateImage.mockResolvedValue({ image: null, mood: null, safetyBlocked: false });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(502);
    expect(store.data.get(variantKey())).toBe(0); // 선점분 환불됨
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
