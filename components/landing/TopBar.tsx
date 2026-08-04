import { currentIssue } from '@/lib/issue';

/** 상단 미니 바 — 로고 + 발행호 배지. 스크롤과 무관하게 항상 고정. */
export default function TopBar() {
  const issue = currentIssue();
  return (
    <header className="xp-topbar">
      <a className="xp-logo" href="#top">
        이달아<span aria-hidden>✳</span>
      </a>
      <nav className="xp-topnav">
        <span className="xp-pill t-blue" suppressHydrationWarning>
          VOL.{issue.vol} 발행 중
        </span>
        <a className="xp-pill t-green" href="#tool">
          시안 만들기
        </a>
      </nav>
    </header>
  );
}
