import Link from 'next/link';
import { getStripe } from '@/lib/stripe';
import { PACK_CREDITS, markPaid } from '@/lib/payments';

/**
 * /pay/success — Stripe Checkout 복귀 페이지.
 *
 * webhook(/api/stripe/webhook)이 횟수를 지급하는 게 정식 경로지만,
 * webhook이 늦거나 실패해도 여기서 세션을 직접 조회해 지급한다.
 * Stripe API로 확인한 paid 세션만 처리하므로 위조가 불가능하다.
 * markPaid는 멱등이라 webhook과 동시에 달려도 안전하다.
 */
export default async function PaySuccess({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;
  const stripe = getStripe();
  let ok = false;

  if (stripe && session_id) {
    try {
      const s = await stripe.checkout.sessions.retrieve(session_id);
      const sub = s.metadata?.google_sub;
      if (s.payment_status === 'paid' && sub) {
        // DB 기록이 실패하면 "열렸어요"라고 거짓말하지 않는다 — webhook 재시도가 마저 처리한다
        ok = await markPaid({
          googleSub: sub,
          email: s.customer_email ?? s.customer_details?.email ?? '',
            sessionId: s.id,
        });
      }
    } catch {
      ok = false;
    }
  }

  return (
    <main className="screen">
      <div className="blocked">
        <div className="blocked-card" role="status">
          <p className="overline">{ok ? 'Payment confirmed' : 'Payment pending'}</p>
          <h2 className="headline">
            {ok ? `${PACK_CREDITS}회 이용권이 들어왔어요` : '결제 확인 중이에요'}
          </h2>
          <p className="sub">
            {ok
              ? '이제 이달아에서 이달의 네일 세트를 만들 수 있어요. 만들기에 실패한 회차는 차감되지 않아요.'
              : '결제는 접수됐는데 확인이 늦어지고 있어요. 잠시 후 다시 들어오면 횟수가 들어와 있어요.'}
          </p>
          <div className="blocked-actions">
            <Link className="btn-fill" href="/#tool">
              만들러 가기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
