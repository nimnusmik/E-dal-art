import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { markPaid } from '@/lib/payments';

/**
 * POST /api/stripe/webhook — Stripe 결제 완료 수신.
 *
 * 서명은 STRIPE_WEBHOOK_SECRET으로 검증한다. 서명이 틀리면 400 —
 * 위조 요청으로 횟수가 늘어나는 일이 없게 한다.
 *
 * checkout.session.completed에서 metadata.google_sub을 읽어 횟수권을
 * 지급한다. Stripe는 "최소 1회" 전달하므로 markPaid는 멱등이다.
 */

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'WEBHOOK_UNAVAILABLE' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 400 });

  let event: Stripe.Event;
  try {
    // 서명 검증에는 반드시 원문 바디가 필요하다 — json()으로 파싱하면 안 된다
    const raw = await req.text();
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    const sub = s.metadata?.google_sub;
    if (sub && s.payment_status === 'paid') {
      const ok = await markPaid({
        googleSub: sub,
        email: s.customer_email ?? s.customer_details?.email ?? '',
        sessionId: s.id,
      });
      // DB 기록 실패를 200으로 삼키면 Stripe가 재전송하지 않아 결제하고도 이용권이
      // 없는 사용자가 생긴다 — 500으로 재시도를 받는다 (markPaid는 멱등)
      if (!ok) return NextResponse.json({ error: 'RECORD_FAILED' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
