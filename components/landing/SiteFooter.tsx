'use client';

import { useIssue } from '@/lib/useIssue';

/**
 * 미니 풋터 바. <main> 밖에 있어야 contentinfo 랜드마크로 노출된다.
 * 발행호 번호(VOL.N)는 쓰지 않는다 — 달력 계산값이라 거짓 이력으로 읽힌다.
 */
export default function SiteFooter() {
  const issue = useIssue();
  return (
    <footer className="xp-footer-shell">
      <div className="xp-footer-bar">
        <span>idala — AI nail sets, monthly</span>
        <span className="xp-footer-meta">
          <span suppressHydrationWarning>{issue.monthLabel}</span>
          <a href="#faq">FAQ</a>
          {/* 처리방침은 어느 화면에서든 닿을 수 있어야 한다 */}
          <a href="/privacy">Privacy</a>
          {/* 결제 의사를 묻는 페이지에 문의 채널이 없으면 신뢰가 깎인다 */}
          <a href="mailto:kimsunmin0227@gmail.com">Contact</a>
        </span>
      </div>
    </footer>
  );
}
