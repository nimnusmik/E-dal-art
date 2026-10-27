import Link from 'next/link';
import { getTransaction, isPaidTransaction } from '@/lib/paddle';
import { PACK_CREDITS, markPaid } from '@/lib/payments';

/**
 * /pay/success — Paddle 결제창이 닫힌 뒤 오는 페이지.
 *
 * webhook(/api/paddle/webhook)이 횟수를 지급하는 게 정식 경로지만,
 * webhook이 늦거나 실패해도 여기서 거래를 직접 조회해 지급한다.
 * Paddle API로 확인한 결제 완료 거래만 처리하므로 위조가 불가능하다.
 * markPaid는 멱등이라 webhook과 동시에 달려도 안전하다.
 */
export default async function PaySuccess({
  searchParams,
}: {
  searchParams: Promise<{ txn?: string }>;
}) {
  const { txn } = await searchParams;
  let ok = false;

  const t = txn ? await getTransaction(txn) : null;
  const sub = t?.custom_data?.google_sub;
  if (t && isPaidTransaction(t) && typeof sub === 'string') {
    // DB 기록이 실패하면 "들어왔어요"라고 거짓말하지 않는다 — webhook 재전송이 마저 처리한다
    ok = await markPaid({ googleSub: sub, email: '', paymentRef: t.id });
  }

  return (
    <main className="screen">
      <div className="blocked">
        <div className="blocked-card" role="status">
          <p className="overline">{ok ? 'Payment confirmed' : 'Payment pending'}</p>
          <h2 className="headline">
            {ok ? `${PACK_CREDITS} runs added` : 'Confirming your payment'}
          </h2>
          <p className="sub">
            {ok
              ? 'You can make nail sets now. Failed runs never count.'
              : 'We got your payment but confirmation is taking a moment. Your runs will show up shortly.'}
          </p>
          <div className="blocked-actions">
            <Link className="btn-fill" href="/#tool">
              Start making
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
