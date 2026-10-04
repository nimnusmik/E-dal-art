import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createCheckoutTransaction, paddleConfigured } from '@/lib/paddle';

/**
 * POST /api/checkout — Paddle 거래를 만들고 id를 돌려준다. 화면은 이 id로
 * Paddle 결제창(오버레이)을 연다. 카드 입력·승인은 전부 Paddle에서 일어난다.
 *
 * 로그인 필수 — 누구에게 횟수를 줄지 거래의 custom_data에 서버가 직접 적는다.
 * 횟수권이라 재구매를 막지 않는다.
 *
 * 성공 후: webhook(/api/paddle/webhook)이 횟수를 더한다.
 * webhook이 늦으면 /pay/success가 거래를 직접 조회해 같은 처리를 한다.
 */

export async function POST(): Promise<NextResponse> {
  let sub: string | null = null;
  try {
    sub = (await auth())?.user?.id ?? null;
  } catch {
    sub = null;
  }
  if (!sub) return NextResponse.json({ error: 'LOGIN_REQUIRED' }, { status: 401 });
  if (!paddleConfigured()) {
    return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }
  try {
    return NextResponse.json({ transactionId: await createCheckoutTransaction(sub) });
  } catch (err) {
    console.error('[checkout] Paddle 거래 생성 실패', err);
    return NextResponse.json({ error: 'PAYMENT_UNAVAILABLE' }, { status: 503 });
  }
}
