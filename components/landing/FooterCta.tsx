'use client';

import { useAccess } from '@/lib/useAccess';
import { FREE_CREDITS, PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

/**
 * 초원 배경 초대형 타이포 CTA. 풋터 바는 <main> 밖 SiteFooter가 소유한다.
 * 2026-10-27부터 가입하면 무료 횟수가 있다 — 비로그인에게는 무료 체험을, 0회 남은 사람에게만 가격을.
 */
export default function FooterCta() {
  const access = useAccess();
  const price = `₩${PRICE_REGULAR_KRW.toLocaleString('ko-KR')}`;
  const cta = access.paid ? 'Create my set' : access.email ? `Get ${PACK_CREDITS} runs for ${price}` : `Try ${FREE_CREDITS} runs free`;
  return (
    <section className="xp-meadow xp-footer-cta" aria-label="Go create a set">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue" aria-hidden>
          {FREE_CREDITS} runs free · no subscription
        </span>
        <h2 className="xp-display xp-footer-title">
          Meet this month&apos;s nails
          <br />
          before anyone else
        </h2>
        <a className="xp-cta" href="#tool">
          {cta}
        </a>
      </div>
    </section>
  );
}
