import type { ReactNode } from 'react';
import HeroHand from '@/components/story/HeroHand';
import TopBar from './TopBar';
import Stats from './Stats';
import Gallery from './Gallery';
import Services from './Services';
import ToolSection from './ToolSection';
import Testimonials from './Testimonials';
import Faq from './Faq';
import FooterCta from './FooterCta';

/**
 * phase === 'start'일 때의 원페이지 랜딩.
 * 프레젠테이션 전용 — 툴 상태/핸들러는 app/page.tsx가 소유하고 toolSlot으로 주입한다.
 */
export default function Landing({ toolSlot }: { toolSlot: ReactNode }) {
  return (
    <main className="xp-landing">
      <TopBar />
      <HeroHand />
      <Stats />
      <Gallery />
      <Services />
      <ToolSection>{toolSlot}</ToolSection>
      <Testimonials />
      <Faq />
      <FooterCta />
    </main>
  );
}
