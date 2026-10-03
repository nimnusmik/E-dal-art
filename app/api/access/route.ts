import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getQuota } from '@/lib/quota';
import { currentAccountEmail, dailyLimits, quotaSubject } from '@/lib/request';
import { getStripe } from '@/lib/stripe';
import { PRICE_EARLY_KRW, PRICE_REGULAR_KRW, isPaidBySub } from '@/lib/payments';

/**
 * GET /api/access — 이용 상태 조회 (차감 없음).
 *
 * 예전 GET /api/analyze가 하던 "게이트 상태" 조회를 대체한다.
 * 랜딩·툴 카드가 페이월/로그인/생성 중 무엇을 보여줄지 이 하나로 결정한다.
 */

export async function GET(req: Request): Promise<NextResponse> {
  const { userLimit, totalLimit } = dailyLimits();
  const subject = await quotaSubject(req);
  const quota = await getQuota(getRedis(), subject, new Date(), userLimit, totalLimit);

  let paid = false;
  if (subject.startsWith('u:')) {
    paid = await isPaidBySub(subject.slice(2));
  }

  // 얼리버드 남은 수량 — 쿠폰의 times_redeemed 기준. 조회 실패하면 null
  // (모르면 얼리버드가를 보여주지 않는다 — 없는 할인을 약속하지 않게)
  let earlyBirdLeft: number | null = null;
  const stripe = getStripe();
  const couponId = process.env.STRIPE_EARLYBIRD_COUPON_ID;
  if (stripe && couponId) {
    try {
      const coupon = await stripe.coupons.retrieve(couponId);
      const max = coupon.max_redemptions ?? 0;
      earlyBirdLeft = coupon.valid ? Math.max(0, max - coupon.times_redeemed) : 0;
    } catch {
      earlyBirdLeft = null;
    }
  }

  return NextResponse.json({
    paid,
    remaining: quota.userRemaining,
    email: await currentAccountEmail(),
    earlyBirdLeft,
    priceRegular: PRICE_REGULAR_KRW,
    priceEarly: PRICE_EARLY_KRW,
  });
}
