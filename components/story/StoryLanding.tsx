import type { ReactNode } from 'react';
import HeroHand from './HeroHand';
import HowItWorks from './HowItWorks';
import BeadMorph from './BeadMorph';
import StoryFooter from './StoryFooter';
import { currentIssue } from '@/lib/issue';

/** 마퀴 티커 — 잡지 발행 스트립. 동일 문구 2회 반복으로 무한 루프 */
function Ticker() {
  const issue = currentIssue();
  const line = `Nail of the Month ✦ 이달의 네일 ✦ ${issue.monthLabel} — Vol.${issue.vol} ✦ Glazed · Chrome · 3D Parts ✦ `;
  return (
    <div className="ticker" aria-hidden>
      <div className="ticker-track" suppressHydrationWarning>
        <span>{line}</span>
        <span>{line}</span>
      </div>
    </div>
  );
}

/**
 * phase === 'start'일 때의 원페이지 스토리 랜딩.
 * 프레젠테이션 전용 — 툴 상태/핸들러는 page.tsx가 소유하고 toolSlot으로 주입.
 */
export default function StoryLanding({ toolSlot }: { toolSlot: ReactNode }) {
  return (
    <main className="story">
      <HeroHand />
      <Ticker />
      <HowItWorks />
      <BeadMorph />
      <section className="story-tool" id="tool">
        <span className="section-ghost" aria-hidden>03</span>
        <div className="tool-column">{toolSlot}</div>
      </section>
      <StoryFooter />
    </main>
  );
}
