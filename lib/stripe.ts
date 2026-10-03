import Stripe from 'stripe';

/**
 * Stripe 클라이언트 (지연 생성 싱글턴).
 *
 * STRIPE_SECRET_KEY가 없으면 null — 결제 라우트들이 503 PAYMENT_UNAVAILABLE로
 * 응답한다. 키 없이 배포해도 랜딩·예시는 계속 돌아가게 하려는 의도다.
 *
 * 카드번호 같은 것은 이 앱을 절대 거치지 않는다. 결제는 전부 Stripe Checkout
 * (PG사 호스팅 페이지)에 위임하고, 우리는 참조 ID와 결제 시각만 DB에 둔다
 * (db/schema.sql 설계 규칙 1).
 */

let client: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client = new Stripe(key);
  return client;
}
