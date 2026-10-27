'use client';

import { useAccess } from '@/lib/useAccess';
import { FREE_CREDITS, PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

/**
 * 가격 섹션 — 갤러리 바로 뒤.
 *
 * 예전에는 가짜 가격 버튼(수요 측정용)이 있었다. 이제 실제 결제(Paddle)로
 * 바뀌었으므로 진짜 가격을 보여준다 (PACK_CREDITS회 횟수권).
 */
export default function PriceSection() {
  const access = useAccess();

  return (
    <section className="xp-paper xp-price" id="pricing" aria-label="Pricing">
      <div className="xp-head">
        <span className="xp-pill t-purple" aria-hidden>
          Pricing
        </span>
        <h2>Start free, pay only if you love it</h2>
      </div>
      <div className="xp-price-inner">
        <div className="xp-price-card">
          <p className="xp-price-now">₩{PRICE_REGULAR_KRW.toLocaleString('ko-KR')}</p>
          <p className="assurance xp-price-unit">for {PACK_CREDITS} runs</p>
          <ul className="xp-price-list">
            <li>Your first {FREE_CREDITS} runs are on us</li>
            <li>One-time payment, no subscription</li>
            <li>Runs never expire, and failed ones don&apos;t count</li>
            <li>Pay with KakaoPay or any Korean card</li>
          </ul>
          <a className="xp-cta" href="#tool">
            {/* 비로그인 = 가입하면 무료 횟수가 있다. 로그인했는데 0회일 때만 구매 문구 */}
            {access.paid ? 'Create my set' : access.email ? 'Get the pass' : 'Try it free'}
          </a>
        </div>
      </div>
    </section>
  );
}
