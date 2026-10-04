import { createHmac, timingSafeEqual } from 'node:crypto';
import { PACK_CREDITS, PRICE_REGULAR_KRW } from './pricing';

/**
 * Paddle Billing (판매 기록자, Merchant of Record).
 *
 * 사업자등록 없이 개인으로 판매하려고 Stripe 대신 쓴다. Paddle이 판매자로서 결제·세금·
 * 영수증·환불을 맡고, 국내 카드·카카오페이·네이버페이를 지원한다.
 * 카드번호는 이 앱을 절대 거치지 않는다 — 우리는 거래 id와 지급 횟수만 DB에 둔다.
 *
 * 샌드박스/라이브는 API 키 접두사로 가른다(pdl_sdbx_ / pdl_live_) — 별도 환경변수를 두면
 * 키와 환경이 어긋날 수 있다(Stripe Price ID에서 실제로 겪은 일).
 */

function apiKey(): string | null {
  return process.env.PADDLE_API_KEY || null;
}

function baseUrl(key: string): string {
  return key.includes('_sdbx_') ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
}

async function paddle<T>(key: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(baseUrl(key) + path, {
    method: init?.method ?? 'GET',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const json = (await res.json().catch(() => null)) as { data?: T; error?: { code?: string; detail?: string } } | null;
  if (!res.ok || !json?.data) {
    throw new Error(`Paddle ${path} ${res.status}: ${json?.error?.code ?? ''} ${json?.error?.detail ?? ''}`);
  }
  return json.data;
}

export function paddleConfigured(): boolean {
  return apiKey() !== null;
}

/**
 * 결제용 거래 생성 — 화면이 이 id로 Paddle 결제창(오버레이)을 연다.
 *
 * 카탈로그 상품·가격 id를 쓰지 않고 금액을 직접 넘긴다: 대시보드의 id가 키와 다른
 * 환경을 가리켜 결제가 전부 막히는 일이 없고, 표시가와 과금액이 같은 상수에서 나온다.
 * tax_mode internal = 표시가에 세금 포함 → 손님은 정확히 ₩9,900을 낸다.
 * KRW는 소수점 없는 통화라 "9900" = ₩9,900.
 */
export async function createCheckoutTransaction(googleSub: string): Promise<string> {
  const key = apiKey();
  if (!key) throw new Error('PADDLE_API_KEY 없음');
  const txn = await paddle<{ id: string }>(key, '/transactions', {
    method: 'POST',
    body: {
      currency_code: 'KRW',
      items: [
        {
          quantity: 1,
          price: {
            description: `이달아 ${PACK_CREDITS}회 이용권`,
            name: `${PACK_CREDITS}회 이용권`,
            tax_mode: 'internal',
            unit_price: { amount: String(PRICE_REGULAR_KRW), currency_code: 'KRW' },
          },
          product: { name: `이달아 ${PACK_CREDITS}회 이용권`, tax_category: 'standard' },
        },
      ],
      // 웹훅이 누구에게 횟수를 줄지 아는 유일한 연결고리
      custom_data: { google_sub: googleSub },
    },
  });
  return txn.id;
}

export interface PaddleTransaction {
  id: string;
  status: string;
  custom_data: { google_sub?: unknown } | null;
}

/** /pay/success 폴백용 — 웹훅이 늦어도 서버가 직접 확인한 거래만 처리한다 */
export async function getTransaction(id: string): Promise<PaddleTransaction | null> {
  const key = apiKey();
  if (!key) return null;
  try {
    return await paddle<PaddleTransaction>(key, `/transactions/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

/** 결제가 끝난 거래인가 — completed(처리 완료) 또는 paid(결제됨, 처리 중) */
export function isPaidTransaction(t: { status: string }): boolean {
  return t.status === 'completed' || t.status === 'paid';
}

/**
 * Paddle-Signature 검증 — 헤더 "ts=…;h1=…", 서명 = HMAC-SHA256(secret, `${ts}:${원문 바디}`).
 * 오래된 서명은 재전송 공격으로 보고 거절한다(Paddle 권장 5초, 시계 오차를 감안해 넉넉히).
 */
export function verifyPaddleSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  nowMs = Date.now(),
  toleranceSec = 300,
): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(';').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i), p.slice(i + 1)];
    }),
  );
  const ts = Number(parts.ts);
  if (!Number.isFinite(ts) || Math.abs(nowMs / 1000 - ts) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${parts.ts}:${rawBody}`).digest('hex');
  // 시크릿 교체 중에는 h1이 여러 개 올 수 있다 — 하나라도 맞으면 통과
  return header
    .split(';')
    .filter((p) => p.startsWith('h1='))
    .some((p) => {
      const got = Buffer.from(p.slice(3), 'utf8');
      const want = Buffer.from(expected, 'utf8');
      return got.length === want.length && timingSafeEqual(got, want);
    });
}
