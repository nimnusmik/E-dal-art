'use client';

import { useGate } from '@/lib/useGate';

/**
 * 초원 배경 초대형 타이포 CTA. 풋터 바는 <main> 밖 SiteFooter가 소유한다.
 * 페이지 끝까지 읽고도 초대가 없는 사람에게는 두 번째 제안(구독 알림)을 함께 보인다 —
 * 유일한 전환 경로가 닫힌 문이면 여기서 이탈이 확정된다.
 */
export default function FooterCta() {
  const gate = useGate();
  const gated = gate.inviteRequired && !gate.hasInvite;
  return (
    <section className="xp-meadow xp-footer-cta" aria-label="Go create a set">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue" aria-hidden>
          Ready?
        </span>
        <h2 className="xp-display xp-footer-title">
          Meet this month's nails
          <br />
          before anyone else
        </h2>
        <a className="xp-cta" href="#tool">
          {gated ? 'Start with an invite code' : 'Create for free'}
        </a>
        {gated && (
          <a className="xp-footer-alt" href="#subscribe">
            No invite? Get notified when it opens
          </a>
        )}
      </div>
    </section>
  );
}
