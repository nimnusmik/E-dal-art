import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

import { POST } from '@/app/api/checkout/route';
import { auth } from '@/auth';

const mockAuth = vi.mocked(auth);
const mockFetch = vi.fn();
const savedEnv = { ...process.env };

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: 'test-sub', email: 'buyer@example.com' } } as never);
  mockFetch.mockReset().mockResolvedValue(
    new Response(JSON.stringify({ data: { id: 'txn_abc' } }), { status: 201 }),
  );
  vi.stubGlobal('fetch', mockFetch);
  process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_test';
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...savedEnv };
});

describe('POST /api/checkout', () => {
  it('미로그인 → 401 LOGIN_REQUIRED, Paddle 호출 안 함', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await POST();
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('LOGIN_REQUIRED');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('Paddle 키 없음 → 503 PAYMENT_UNAVAILABLE', async () => {
    delete process.env.PADDLE_API_KEY;
    const res = await POST();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_UNAVAILABLE');
  });

  it('거래를 만들고 id 반환 — 금액은 상수로 직접, 계정은 custom_data로', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    expect((await res.json()).transactionId).toBe('txn_abc');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://sandbox-api.paddle.com/transactions'); // 샌드박스 키 → 샌드박스
    expect(init.headers.authorization).toBe('Bearer pdl_sdbx_apikey_test');
    const body = JSON.parse(init.body);
    expect(body.custom_data).toEqual({ google_sub: 'test-sub' });
    expect(body.items[0].price.unit_price).toEqual({ amount: '9900', currency_code: 'KRW' });
    expect(body.items[0].price.tax_mode).toBe('internal'); // 세금 포함 — 손님은 정확히 ₩9,900
  });

  it('라이브 키면 라이브 API로', async () => {
    process.env.PADDLE_API_KEY = 'pdl_live_apikey_test';
    await POST();
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.paddle.com/transactions');
  });

  it('Paddle이 거절하면 503 (500으로 터지지 않는다)', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'forbidden', detail: 'x' } }), { status: 403 }),
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST();
    expect(res.status).toBe(503);
  });
});
