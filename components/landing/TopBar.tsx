'use client';

import { useEffect, useState } from 'react';
import { useGate } from '@/lib/useGate';
import { useIssue } from '@/lib/useIssue';

/**
 * 상단 미니 바 — 로고 + 이달의 호 + CTA.
 * 아래로 스크롤하면 숨고 위로 올리면 돌아온다. 390px에서 이 바가 세로의 7.3%를
 * 상시 점유하고 알약 2개가 폭의 44%를 덮어 본문 글자를 잘라먹었다.
 */
export default function TopBar() {
  const issue = useIssue();
  const gate = useGate();
  const [hidden, setHidden] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    let lastY = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        setSolid(y > 40);
        // 첫 화면에서는 항상 보인다. 그 아래에서만 방향에 따라 숨긴다.
        if (y < 120) setHidden(false);
        else if (y > lastY + 8) setHidden(true);
        else if (y < lastY - 8) setHidden(false);
        lastY = y;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header className={`xp-topbar${hidden ? ' is-hidden' : ''}${solid ? ' is-solid' : ''}`}>
      <a className="xp-logo" href="#top">
        이달아<span aria-hidden>✳</span>
      </a>
      <nav className="xp-topnav" aria-label="주요 메뉴">
        <span className="xp-pill t-blue xp-issue-pill" suppressHydrationWarning>
          {issue.koLabel}
        </span>
        {/* 게이트 상태에 따라 정직한 문구 — 히어로 CTA와 같은 규칙 */}
        <a className="xp-pill xp-cta-top" href="#tool">
          {gate.inviteRequired && !gate.hasInvite ? '초대 코드로 시작하기' : '무료로 시안 만들기'}
        </a>
      </nav>
    </header>
  );
}
