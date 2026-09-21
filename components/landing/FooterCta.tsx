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
    <section className="xp-meadow xp-footer-cta" aria-label="시안 만들러 가기">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue" aria-hidden>
          Ready?
        </span>
        <h2 className="xp-display xp-footer-title">
          이달의 네일을
          <br />
          먼저 만나요
        </h2>
        <a className="xp-cta" href="#tool">
          {gated ? '초대 코드로 시작하기' : '무료로 시안 만들기'}
        </a>
        {gated && (
          <a className="xp-footer-alt" href="#subscribe">
            초대가 없다면 — 열릴 때 알림 받기
          </a>
        )}
      </div>
    </section>
  );
}
