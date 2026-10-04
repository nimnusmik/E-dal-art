'use client';

import { useAccess } from '@/lib/useAccess';

/**
 * 가격 섹션 — 갤러리 바로 뒤.
 *
 * 예전에는 가짜 가격 버튼(수요 측정용)이 있었다. 이제 실제 Stripe 결제로
 * 바뀌었으므로 진짜 가격을 보여준다. 10회 횟수권 — 얼리버드 쿠폰이
 * 살아 있으면 그 가격을, 아니면 정가를.
 */
export default function PriceSection() {
  const access = useAccess();
  const earlyBird = access.earlyBirdLeft !== null && access.earlyBirdLeft > 0;
  const fmt = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

  return (
    <section className="xp-paper xp-price" id="pricing" aria-label="Pricing">
      <div className="xp-head">
        <span className="xp-pill t-purple" aria-hidden>
          Pricing
        </span>
        <h2>10 runs, no subscription</h2>
      </div>
      <div className="xp-price-inner">
        <div className="xp-price-card">
          {earlyBird ? (
            <>
              <p className="xp-price-flag">Early bird · {access.earlyBirdLeft} of 100 left</p>
              <p className="xp-price-now">{fmt(access.priceEarly)}</p>
              <p className="xp-price-was">
                <s>{fmt(access.priceRegular)}</s>
              </p>
            </>
          ) : (
            <p className="xp-price-now">{fmt(access.priceRegular)}</p>
          )}
          <ul className="xp-price-list">
            <li>10 runs — use them whenever, they never expire</li>
            <li>Each run: a full set of takes + try-on shots</li>
            <li>Failed runs don&apos;t count</li>
            <li>Secure checkout via Stripe</li>
          </ul>
          <a className="xp-cta" href="#tool">
            {access.paid ? 'Create my set' : 'Get the pass'}
          </a>
        </div>
      </div>
    </section>
  );
}
