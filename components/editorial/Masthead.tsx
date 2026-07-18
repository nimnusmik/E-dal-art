import { currentIssue } from '@/lib/issue';

/** 매거진 매스트헤드 — 세리프 워드마크 + 동적 발행호 (전 화면 공용) */
export default function Masthead() {
  const issue = currentIssue();
  return (
    <header className="masthead">
      <span className="masthead-wordmark">이달아</span>
      <span className="masthead-issue overline" suppressHydrationWarning>
        {issue.label}
      </span>
    </header>
  );
}
