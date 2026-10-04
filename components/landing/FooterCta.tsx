'use client';

import { useAccess } from '@/lib/useAccess';

/**
 * 초원 배경 초대형 타이포 CTA. 풋터 바는 <main> 밖 SiteFooter가 소유한다.
 * 무료가 아니다 — "무료"라고 쓰면 결제 페이지에서 배신당한다.
 * 대신 "구독 아님, 쓴 만큼" — 횟수권의 실체를 한 줄로.
 */
export default function FooterCta() {
  const access = useAccess();
  const earlyBird = access.earlyBirdLeft !== null && access.earlyBirdLeft > 0;
  const fmt = (n: number) => `₩${n.toLocaleString('ko-KR')}`;
  const cta = access.paid
    ? 'Create my set'
    : earlyBird
      ? `얼리버드 ${fmt(access.priceEarly)}으로 시작하기`
      : `${fmt(access.priceRegular)}으로 시작하기`;
  return (
    <section className="xp-meadow xp-footer-cta" aria-label="Go create a set">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue" aria-hidden>
          {earlyBird && !access.paid ? `Early bird · ${access.earlyBirdLeft} left` : '10 runs · no subscription'}
        </span>
        <h2 className="xp-display xp-footer-title">
          Meet this month&apos;s nails
          <br />
          before anyone else
        </h2>
        <a className="xp-cta" href="#tool">
          {cta}
        </a>
        {!access.paid && (
          <p className="xp-footer-note">
            {earlyBird
              ? `얼리버드 ${fmt(access.priceEarly)} (정가 ${fmt(access.priceRegular)}) · 선착순 100명`
              : `10회 이용권 ${fmt(access.priceRegular)} · 구독 아님`}
          </p>
        )}
      </div>
    </section>
  );
}
