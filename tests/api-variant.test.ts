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
// 로그인 주체용 — 결제 게이트는 analyze가 차감하고 발급한 토큰이 대신한다
vi.mock('@/auth', () => ({ auth: vi.fn() }));
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
import { issueVariantToken } from '@/lib/variantToken';
import { auth } from '@/auth';
import type { NailJudgement } from '@/lib/judge';
import type { NailBrief } from '@/lib/brief';
import type { VariantPlan } from '@/lib/types';
import { POST } from '@/app/api/variant/route';

const mockGenerateImage = vi.mocked(generateImage);
const mockJudgeImage = vi.mocked(judgeImage);
const mockAuth = vi.mocked(auth);

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
  // analyze를 거친 세션 토큰 — 같은 주체·당일 것만 유효하다 (로그인 계정 기준)
  variantToken: issueVariantToken('u:test-sub', new Date()),
};

function variantKey(token = VALID_BODY.variantToken): string {
  return 'quota:variant:' + sidOf(token) + ':' + kstToday();
}

/** 토큰 안의 세션 id — variant·hero 한도 키가 세션 단위다 */
function sidOf(token: string): string {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf8')).sid;
}


beforeEach(async () => {
  // @/auth는 라우트에서 동적 import된다 — 모듈 캐시를 미리 채워
  // 동시 요청 테스트의 로딩 경합을 피한다
  await import('@/auth');
  store.reset();
  mockGenerateImage.mockReset();
  mockJudgeImage.mockReset();
  mockGenerateImage.mockResolvedValue(GEN_OK);
  mockJudgeImage.mockResolvedValue(CLEAN_JUDGEMENT);
  mockAuth.mockResolvedValue({ user: { id: 'test-sub', email: 'test@example.com' } } as never);
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
    expect(mockGenerateImage).toHaveBeenCalledTimes(1); // 통과작은 재시도 없음
  });

  it('플랜이 브리프에 병합된 프롬프트로 생성한다 (플랜 패턴·파츠 반영)', async () => {
    await POST(makeRequest(VALID_BODY));
    const prompt = mockGenerateImage.mock.calls[0][1];
    expect(prompt).toContain(VALID_PLAN.patternLines[0]);
    expect(prompt).toContain(VALID_PLAN.partsLine);
  });

  it('낙제작도 반환한다 — 1회 재시도 후에도 낙제면 quality.pass=false 표시만 (422 아님)', async () => {
    mockJudgeImage.mockResolvedValue({ ...CLEAN_JUDGEMENT, physicsOk: false });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).quality.pass).toBe(false);
    expect(mockGenerateImage).toHaveBeenCalledTimes(2);
  });

  it('낙제작은 1회 재생성하고, 통과한 재시도작을 반환한다', async () => {
    mockGenerateImage
      .mockResolvedValueOnce(GEN_OK)
      .mockResolvedValueOnce({ ...GEN_OK, image: { data: 'cmV0cnk=', mimeType: 'image/png' } });
    mockJudgeImage
      .mockResolvedValueOnce({ ...CLEAN_JUDGEMENT, physicsOk: false })
      .mockResolvedValueOnce(CLEAN_JUDGEMENT);
    const json = await (await POST(makeRequest(VALID_BODY))).json();
    expect(json.tipSet.image).toBe('cmV0cnk=');
    expect(json.quality.pass).toBe(true);
    expect(store.data.get('quota:image:' + kstToday())).toBe(2); // 재시도도 이미지 1장
  });

  it('재시도작이 더 나쁘면 첫 결과를 유지한다', async () => {
    mockGenerateImage
      .mockResolvedValueOnce(GEN_OK)
      .mockResolvedValueOnce({ ...GEN_OK, image: { data: 'd29yc2U=', mimeType: 'image/png' } });
    mockJudgeImage
      .mockResolvedValueOnce({ ...CLEAN_JUDGEMENT, physicsOk: false })
      .mockResolvedValueOnce({ ...CLEAN_JUDGEMENT, physicsOk: false, cleanRender: false, baseMatch: false });
    const json = await (await POST(makeRequest(VALID_BODY))).json();
    expect(json.tipSet.image).toBe('cmVzdWx0');
  });

  it('전역 이미지 한도가 남지 않으면 재시도하지 않는다', async () => {
    store.data.set('quota:image:' + kstToday(), 199); // 첫 장으로 200 도달
    mockJudgeImage.mockResolvedValue({ ...CLEAN_JUDGEMENT, physicsOk: false });
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(200);
    expect(mockGenerateImage).toHaveBeenCalledTimes(1);
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

  it('variantToken이 없거나 위조되면 400 (analyze 우회 차단)', async () => {
    const { variantToken: _omit, ...noToken } = VALID_BODY;
    const res1 = await POST(makeRequest(noToken));
    expect(res1.status).toBe(400);
    const res2 = await POST(makeRequest({ ...VALID_BODY, variantToken: 'forged.token' }));
    expect(res2.status).toBe(400);
    expect((await res2.json()).error).toBe('INVALID_TOKEN');
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('세션 한도(6장) 소진 → 429 RATE_LIMIT_VARIANT, 생성 호출 안 함', async () => {
    store.data.set(variantKey(), 6);
    const res = await POST(makeRequest(VALID_BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe('RATE_LIMIT_VARIANT');
    expect(mockGenerateImage).not.toHaveBeenCalled();
  });

  it('전역 이미지 한도 소진 → 429, 계정을 바꿔도 통과 못 한다', async () => {
    // 계정별 한도만 있으면 계정을 갈아끼우는 만큼 비용이 선형으로 늘어난다.
    // 전역 카운터가 "우회당해도 하루 상한은 고정"을 만드는 지점.
    store.data.set('quota:image:' + kstToday(), 200); // DAILY_IMAGE_LIMIT 기본값
    // 토큰은 주체(계정)에 바인딩되므로 바뀐 계정용으로 새로 발급한다
    mockAuth.mockResolvedValue({ user: { id: 'other-sub', email: 'o@o.co' } } as never);
    const body = { ...VALID_BODY, variantToken: issueVariantToken('u:other-sub', new Date()) };
    const res = await POST(makeRequest(body));
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
    expect(results.filter((r) => r.status === 200)).toHaveLength(6);
    expect(store.data.get(variantKey())).toBe(6);
  });

  it('한도는 세션(횟수권 1회)마다 따로다 — 같은 날 같은 계정이어도 토큰이 다르면 새로 센다', async () => {
    store.data.set(variantKey(), 6); // 앞 세션 소진
    const next = issueVariantToken('u:test-sub', new Date()); // analyze를 다시 거쳐 받은 토큰
    const res = await POST(makeRequest({ ...VALID_BODY, variantToken: next }));
    expect(res.status).toBe(200);
    expect(store.data.get(variantKey(next))).toBe(1);
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
