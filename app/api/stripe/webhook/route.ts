import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { markPaid } from '@/lib/payments';

/**
 * POST /api/stripe/webhook — Stripe 결제 완료 수신.
 *
 * 서명은 STRIPE_WEBHOOK_SECRET으로 검증한다. 서명이 틀리면 400 —
 * 위조 요청으로 paid_at이 찍히는 일이 없게 한다.
 *
 * checkout.session.completed에서 metadata.google_sub을 읽어 이용권을
 * 부여한다. Stripe는 "최소 1회" 전달하므로 markPaid는 멱등이다.
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
      await markPaid({
        googleSub: sub,
        email: s.customer_email ?? s.customer_details?.email ?? '',
        customerId: typeof s.customer === 'string' ? s.customer : '',
        sessionId: s.id,
      });
    }
  }

  return NextResponse.json({ received: true });
}
