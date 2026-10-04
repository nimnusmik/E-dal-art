import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/auth', () => ({ auth: vi.fn() }));

const mockCouponsRetrieve = vi.fn();
const mockSessionsCreate = vi.fn();
let stripeAvailable = true;
vi.mock('@/lib/stripe', () => ({
  getStripe: () => (stripeAvailable ? {
    coupons: { retrieve: mockCouponsRetrieve },
    checkout: { sessions: { create: mockSessionsCreate } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any : null),
}));

import { POST } from '@/app/api/checkout/route';
import { auth } from '@/auth';

const mockAuth = vi.mocked(auth);

const savedEnv = { ...process.env };

beforeEach(() => {
  mockAuth.mockResolvedValue({ user: { id: 'test-sub', email: 'buyer@example.com' } } as never);
  stripeAvailable = true;
  mockCouponsRetrieve.mockReset();
  mockSessionsCreate.mockReset();
  mockSessionsCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/pay/cs_test' });
  process.env.STRIPE_PRICE_ID = 'price_test123';
  process.env.STRIPE_EARLYBIRD_COUPON_ID = 'coupon_test123';
});

afterEach(() => {
  process.env = { ...savedEnv };
});

function post() {
  return POST(new Request('http://localhost/api/checkout', { method: 'POST' }));
}

describe('POST /api/checkout', () => {
  it('미로그인 → 401 LOGIN_REQUIRED', async () => {
    mockAuth.mockResolvedValue(null as never);
    const res = await post();
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe('LOGIN_REQUIRED');
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it('Stripe 키 없음 → 503 PAYMENT_UNAVAILABLE', async () => {
    stripeAvailable = false;
    const res = await post();
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe('PAYMENT_UNAVAILABLE');
  });

  it('얼리버드 쿠폰이 남아 있으면 자동 적용', async () => {
    mockCouponsRetrieve.mockResolvedValue({ valid: true, times_redeemed: 42, max_redemptions: 100 });
    const res = await post();
    expect(res.status).toBe(200);
    expect((await res.json()).url).toBe('https://checkout.stripe.com/pay/cs_test');
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(args.discounts).toEqual([{ coupon: 'coupon_test123' }]);
    expect(args.metadata).toEqual({ google_sub: 'test-sub' });
    expect(args.customer_email).toBe('buyer@example.com');
    expect(args.mode).toBe('payment');
  });

  it('쿠폰이 소진됐으면 정가로 진행 (discounts 없음)', async () => {
    mockCouponsRetrieve.mockResolvedValue({ valid: true, times_redeemed: 100, max_redemptions: 100 });
    const res = await post();
    expect(res.status).toBe(200);
    const args = mockSessionsCreate.mock.calls[0][0];
    expect(args.discounts).toBeUndefined();
  });

  it('쿠폰 조회 실패해도 정가로 진행 (결제를 막지 않는다)', async () => {
    mockCouponsRetrieve.mockRejectedValue(new Error('stripe down'));
    const res = await post();
    expect(res.status).toBe(200);
    expect(mockSessionsCreate).toHaveBeenCalled();
  });
});
