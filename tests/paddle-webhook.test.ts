import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('@/lib/payments', () => ({ markPaid: vi.fn() }));

import { POST } from '@/app/api/paddle/webhook/route';
import { verifyPaddleSignature } from '@/lib/paddle';
import { markPaid } from '@/lib/payments';

const mockMarkPaid = vi.mocked(markPaid);
const SECRET = 'pdl_ntfset_test123';
const savedEnv = { ...process.env };

/** Paddle과 같은 방식으로 서명 — HMAC-SHA256(secret, `${ts}:${body}`) */
function sign(body: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)): string {
  return `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')}`;
}

function event(type: string, data: Record<string, unknown>): string {
  return JSON.stringify({ event_id: 'evt_1', event_type: type, data });
}

const COMPLETED = event('transaction.completed', {
  id: 'txn_123',
  status: 'completed',
  custom_data: { google_sub: 'sub-1' },
});

function request(body: string, signature: string | null): Request {
  return new Request('http://localhost/api/paddle/webhook', {
    method: 'POST',
    headers: signature ? { 'paddle-signature': signature } : {},
    body,
  });
}

beforeEach(() => {
  mockMarkPaid.mockReset().mockResolvedValue(true);
  process.env.PADDLE_WEBHOOK_SECRET = SECRET;
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('verifyPaddleSignature', () => {
  it('맞는 서명은 통과, 바디가 한 글자라도 바뀌면 거절', () => {
    const body = '{"a":1}';
    expect(verifyPaddleSignature(body, sign(body), SECRET)).toBe(true);
    expect(verifyPaddleSignature('{"a":2}', sign(body), SECRET)).toBe(false);
  });

  it('다른 시크릿으로 만든 서명은 거절', () => {
    expect(verifyPaddleSignature('x', sign('x', 'pdl_ntfset_other'), SECRET)).toBe(false);
  });

  it('오래된 서명(재전송 공격)은 거절', () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    expect(verifyPaddleSignature('x', sign('x', SECRET, old), SECRET)).toBe(false);
  });

  it('시크릿 교체 중 h1이 여러 개면 하나만 맞아도 통과', () => {
    const ts = Math.floor(Date.now() / 1000);
    const good = sign('x', SECRET, ts).split(';h1=')[1];
    expect(verifyPaddleSignature('x', `ts=${ts};h1=deadbeef;h1=${good}`, SECRET)).toBe(true);
  });

  it('헤더가 없거나 깨졌으면 거절', () => {
    expect(verifyPaddleSignature('x', null, SECRET)).toBe(false);
    expect(verifyPaddleSignature('x', 'garbage', SECRET)).toBe(false);
  });
});

describe('POST /api/paddle/webhook', () => {
  it('transaction.completed → custom_data의 계정에 지급, 200', async () => {
    const res = await POST(request(COMPLETED, sign(COMPLETED)));
    expect(res.status).toBe(200);
    expect(mockMarkPaid).toHaveBeenCalledWith({ googleSub: 'sub-1', email: '', paymentRef: 'txn_123' });
  });

  it('서명이 틀리면 400, 지급 안 함', async () => {
    const res = await POST(request(COMPLETED, sign(COMPLETED, 'pdl_ntfset_wrong')));
    expect(res.status).toBe(400);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('서명 헤더가 없으면 400', async () => {
    const res = await POST(request(COMPLETED, null));
    expect(res.status).toBe(400);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('DB 기록 실패 시 500 — Paddle이 재전송하게 한다', async () => {
    mockMarkPaid.mockResolvedValue(false);
    const res = await POST(request(COMPLETED, sign(COMPLETED)));
    expect(res.status).toBe(500);
  });

  it('다른 이벤트·google_sub 없는 거래는 지급하지 않는다', async () => {
    const other = event('transaction.created', { id: 'txn_1', custom_data: { google_sub: 'sub-1' } });
    expect((await POST(request(other, sign(other)))).status).toBe(200);
    const noSub = event('transaction.completed', { id: 'txn_2', custom_data: null });
    expect((await POST(request(noSub, sign(noSub)))).status).toBe(200);
    expect(mockMarkPaid).not.toHaveBeenCalled();
  });

  it('시크릿 미설정이면 503', async () => {
    delete process.env.PADDLE_WEBHOOK_SECRET;
    expect((await POST(request(COMPLETED, sign(COMPLETED)))).status).toBe(503);
  });
});
