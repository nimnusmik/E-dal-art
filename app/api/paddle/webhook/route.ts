import { NextResponse } from 'next/server';
import { verifyPaddleSignature } from '@/lib/paddle';
import { markPaid } from '@/lib/payments';

/**
 * POST /api/paddle/webhook — Paddle 결제 완료 수신.
 *
 * 서명은 PADDLE_WEBHOOK_SECRET으로 검증한다. 틀리면 400 — 위조 요청으로 횟수가
 * 늘어나는 일이 없게 한다. transaction.completed의 custom_data.google_sub에 횟수권을
 * 지급한다. Paddle은 실패 시 재전송하므로 markPaid는 멱등이고, 기록 실패는 500으로
 * 돌려 재전송을 받는다.
 */

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'WEBHOOK_UNAVAILABLE' }, { status: 503 });

  // 서명 검증에는 반드시 원문 바디가 필요하다 — json()으로 파싱하면 안 된다
  const raw = await req.text();
  if (!verifyPaddleSignature(raw, req.headers.get('paddle-signature'), secret)) {
    return NextResponse.json({ error: 'BAD_SIGNATURE' }, { status: 400 });
  }

  let event: { event_type?: string; data?: { id?: string; custom_data?: { google_sub?: unknown } | null } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'BAD_BODY' }, { status: 400 });
  }

  if (event.event_type === 'transaction.completed') {
    const sub = event.data?.custom_data?.google_sub;
    const id = event.data?.id;
    if (typeof sub === 'string' && typeof id === 'string') {
      // 결제는 로그인 후에만 시작되므로 계정 행은 이미 있다 — 이메일은 갱신하지 않는다
      const ok = await markPaid({ googleSub: sub, email: '', paymentRef: id });
      if (!ok) return NextResponse.json({ error: 'RECORD_FAILED' }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
