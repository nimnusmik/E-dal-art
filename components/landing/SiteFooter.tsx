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
        <span>이달아 — AI가 만드는 이달의 네일</span>
        <span className="xp-footer-meta">
          <span suppressHydrationWarning>{issue.koLabel}</span>
          <a href="#faq">자주 묻는 질문</a>
        </span>
      </div>
    </footer>
  );
}
