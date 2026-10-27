import Link from 'next/link';

/** /pay/cancel — 결제를 취소하고 돌아왔을 때 */
export default function PayCancel() {
  return (
    <main className="screen">
      <div className="blocked">
        <div className="blocked-card" role="status">
          <p className="overline">Payment cancelled</p>
          <h2 className="headline">Payment cancelled</h2>
          <p className="sub">
            You weren't charged. Come back any time.
          </p>
          <div className="blocked-actions">
            <Link className="btn-fill" href="/#tool">
              Start again
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
