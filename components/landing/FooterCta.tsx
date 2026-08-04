import { currentIssue } from '@/lib/issue';

/** 초원 배경 초대형 타이포 CTA + 미니 풋터 바 */
export default function FooterCta() {
  const issue = currentIssue();
  return (
    <section className="xp-meadow xp-footer-cta" aria-label="시안 만들러 가기">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue">Ready?</span>
        <h2 className="xp-display xp-footer-title">
          이달의 네일을
          <br />
          먼저 만나요
        </h2>
        <a className="xp-cta xp-cta-light" href="#tool">
          이번 호 시안 만들기
        </a>
      </div>
      <footer className="xp-footer-bar">
        <span>이달아 — AI가 만드는 이달의 네일</span>
        <span suppressHydrationWarning>{issue.label}</span>
      </footer>
    </section>
  );
}
