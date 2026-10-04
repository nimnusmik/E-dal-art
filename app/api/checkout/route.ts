import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getStripe } from '@/lib/stripe';
import { PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

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
  if (!stripe) {
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
  let checkout;
  try {
    checkout = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email ?? undefined,
      // 가격을 대시보드 Price ID가 아니라 여기서 직접 넘긴다 — 키와 다른 모드·계정의
      // Price ID를 넣어 "No such price"로 결제가 전부 막힌 적이 있다. 화면 표시가와
      // 과금액도 같은 상수에서 나와 갈라질 수 없다. (KRW는 소수점 없는 통화라 9900 = ₩9,900)
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'krw',
            unit_amount: PRICE_REGULAR_KRW,
            product_data: { name: `이달아 ${PACK_CREDITS}회 이용권` },
          },
        },
      ],
      ...(discounts ? { discounts } : {}),
      metadata: { google_sub: sub },
      success_url: `${origin}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pay/cancel`,
    });
  } catch (err) {
    console.error('[checkout] Stripe 세션 생성 실패', err);
    return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }

  if (!checkout.url) {
    return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }
  return NextResponse.json({ url: checkout.url });
}
