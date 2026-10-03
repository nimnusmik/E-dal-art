import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Stripe from 'stripe';

// 서명 검증은 진짜 stripe-node 로직으로 — 가짜 서명이 통과하면 안 된다
const realWebhooks = new Stripe('sk_test_dummy').webhooks;
vi.mock('@/lib/stripe', () => ({
  getStripe: () => ({ webhooks: realWebhooks }),
}));
vi.mock('@/lib/payments', () => ({
  isPaidBySub: vi.fn(),
  markPaid: vi.fn(),
  PRICE_REGULAR_KRW: 9900,
  PRICE_EARLY_KRW: 4900,
}));

import { POST } from '@/app/api/stripe/webhook/route';
import { markPaid } from '@/lib/payments';

const mockMarkPaid = vi.mocked(markPaid);

const SECRET = 'whsec_test123';
const savedEnv = { ...process.env };

function sessionObject(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cs_test123',
    object: 'checkout.session',
    payment_status: 'paid',
    customer: 'cus_test123',
    customer_email: 'buyer@example.com',
    metadata: { google_sub: 'sub-1' },
    ...overrides,
  };
}

function signedRequest(type: string, obj: Record<string, unknown>, secret = SECRET) {
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type, data: { object: obj } });
  const header = realWebhooks.generateTestHeaderString({ payload, secret });
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  });
}

beforeEach(() => {
  mockMarkPaid.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('POST /api/stripe/webhook', () => {
  it('checkout.session.completed(paid) → markPaid 호출, 200', async () => {
    const res = await POST(signedRequest('checkout.session.completed', sessionObject()));
    expect(res.status).toBe(200);
    expect(mockMarkPaid).toHaveBeenCalledTimes(1);
    expect(mockMarkPaid).toHaveBeenCalledWith({
      googleSub: 'sub-1',
      email: 'buyer@example.com',
      customerId: 'cus_test123',
      sessionId: 'cs_test123',
    });
  });

  it('서명이 틀리면 400, markPaid 미호출', async () => {
    const res = await POST(signedRequest('checkout.session.completed', sessionObject(), 'whsec_wrong'));
    expect(res.status).toBe(400);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('서명 헤더가 없으면 400', async () => {
    const res = await POST(
      new Request('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}' }),
    );
    expect(res.status).toBe(400);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('미결제 세션은 기록하지 않는다', async () => {
    const res = await POST(
      signedRequest('checkout.session.completed', sessionObject({ payment_status: 'unpaid' })),
    );
    expect(res.status).toBe(200);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('google_sub이 없으면 기록하지 않는다', async () => {
    const obj = sessionObject();
    delete (obj.metadata as Record<string, string>).google_sub;
    const res = await POST(signedRequest('checkout.session.completed', obj));
    expect(res.status).toBe(200);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('다른 이벤트는 무시하고 200', async () => {
    const res = await POST(signedRequest('payment_intent.succeeded', { id: 'pi_1' }));
    expect(res.status).toBe(200);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('WEBHOOK_SECRET이 없으면 503', async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(signedRequest('checkout.session.completed', sessionObject()));
    expect(res.status).toBe(503);
  });
});
