import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStripe } from '@/lib/stripe';

/**
 * POST /api/checkout — Stripe Checkout 세션 생성 후 결제 URL 반환.
 *
 * 흐름: 로그인 필수 → 얼리버드 쿠폰이 남아 있으면
 * 자동 적용 → Checkout URL. 실제 카드 입력·승인은 전부 Stripe 호스팅
 * 페이지에서 일어나고, 이 앱은 카드번호를 절대 만지지 않는다.
 *
 * 횟수권이라 재구매를 막지 않는다 — 다 쓰면 다시 산다.
 *
 * 성공 후: webhook(/api/stripe/webhook)이 횟수를 더한다.
 * webhook이 늦으면 /pay/success가 세션을 직접 조회해 같은 처리를 한다.
 */

export async function POST(req: Request): Promise<NextResponse> {
  let sub: string | null = null;
  let email: string | null = null;
  try {
    const session = await auth();
    sub = session?.user?.id ?? null;
    email = session?.user?.email ?? null;
  } catch {
    sub = null;
  }
  if (!sub) return NextResponse.json({ error: 'LOGIN_REQUIRED' }, { status: 401 });

  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID;
  if (!stripe || !priceId) {
    return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }

  // 얼리버드 쿠폰이 아직 살아 있으면 자동 적용 — 다 쓰였으면 정가로 진행한다.
  // 쿠폰 조회 실패도 정가 진행 (결제 자체를 막을 이유가 없다)
  let discounts: { coupon: string }[] | undefined;
  const couponId = process.env.STRIPE_EARLYBIRD_COUPON_ID;
  if (couponId) {
    try {
      const coupon = await stripe.coupons.retrieve(couponId);
      const max = coupon.max_redemptions ?? Number.POSITIVE_INFINITY;
      if (coupon.valid && coupon.times_redeemed < max) {
        discounts = [{ coupon: couponId }];
      }
    } catch {
      /* 정가로 진행 */
    }
  }

  const origin = new URL(req.url).origin;
  const checkout = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: email ?? undefined,
    line_items: [{ price: priceId, quantity: 1 }],
    ...(discounts ? { discounts } : {}),
    metadata: { google_sub: sub },
    success_url: `${origin}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pay/cancel`,
  });

  if (!checkout.url) {
    return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ url: checkout.url });
}
