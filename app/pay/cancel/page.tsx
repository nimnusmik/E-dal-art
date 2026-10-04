import Link from 'next/link';

/** /pay/cancel — 결제를 취소하고 돌아왔을 때 */
export default function PayCancel() {
  return (
    <main className="screen">
      <div className="blocked">
        <div className="blocked-card" role="status">
          <p className="overline">Payment cancelled</p>
          <h2 className="headline">결제가 취소됐어요</h2>
          <p className="sub">
            결제된 금액은 없어요. 마음이 바뀌면 언제든 다시 시작할 수 있어요.
          </p>
          <div className="blocked-actions">
            <Link className="btn-fill" href="/#tool">
              다시 시작하기
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
