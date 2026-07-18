import { currentIssue } from '@/lib/issue';

export default function StoryFooter() {
  const issue = currentIssue();
  return (
    <footer className="story-footer">
      <span className="footer-credit">이달아 — AI가 만드는 이달의 네일</span>
      <span className="overline" suppressHydrationWarning>
        {issue.label}
      </span>
    </footer>
  );
}
