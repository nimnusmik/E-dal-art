'use client';

import { useAccess } from '@/lib/useAccess';
import { PRICE_REGULAR_KRW } from '@/lib/pricing';

/**
 * 가격 섹션 — 갤러리 바로 뒤.
 *
 * 예전에는 가짜 가격 버튼(수요 측정용)이 있었다. 이제 실제 결제(Paddle)로
 * 바뀌었으므로 진짜 가격을 보여준다 (10회 횟수권).
 */
export default function PriceSection() {
  const access = useAccess();

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
          <p className="xp-price-now">₩{PRICE_REGULAR_KRW.toLocaleString('ko-KR')}</p>
          <ul className="xp-price-list">
            <li>10 runs — use them whenever, they never expire</li>
            <li>Each run: a full set of takes + try-on shots</li>
            <li>Failed runs don&apos;t count</li>
            <li>Secure checkout via Paddle — KakaoPay &amp; Korean cards</li>
          </ul>
          <a className="xp-cta" href="#tool">
            {access.paid ? 'Create my set' : 'Get the pass'}
          </a>
        </div>
      </div>
    </section>
  );
}
