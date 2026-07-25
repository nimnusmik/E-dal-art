import type { ReactNode } from 'react';
import HeroHand from './HeroHand';
import HowItWorks from './HowItWorks';
import BeforeAfter from './BeforeAfter';
import StoryFooter from './StoryFooter';

/**
 * phase === 'start'일 때의 원페이지 스토리 랜딩.
 * 프레젠테이션 전용 — 툴 상태/핸들러는 page.tsx가 소유하고 toolSlot으로 주입.
 */
export default function StoryLanding({ toolSlot }: { toolSlot: ReactNode }) {
  return (
    <main className="story">
      <HeroHand />
      <HowItWorks />
      <BeforeAfter />
      <section className="story-tool" id="tool">
        <div className="tool-column">{toolSlot}</div>
      </section>
      <StoryFooter />
    </main>
  );
}
