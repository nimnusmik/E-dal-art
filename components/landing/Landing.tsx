import type { ReactNode } from 'react';
import HeroHand from '@/components/story/HeroHand';
import TopBar from './TopBar';
import Stats from './Stats';
import Gallery from './Gallery';
import Services from './Services';
import ToolSection from './ToolSection';
import Testimonials from './Testimonials';
import Faq from './Faq';
import PriceSection from './PriceSection';
import FooterCta from './FooterCta';
import SiteFooter from './SiteFooter';

/**
 * phase === 'start'일 때의 원페이지 랜딩.
 * 프레젠테이션 전용 — 툴 상태/핸들러는 app/page.tsx가 소유하고 toolSlot으로 주입한다.
 *
 * 구조 두 가지 원칙:
 *  1) <header>·<footer>는 <main> **밖**에 둔다. sectioning content 내부에 들어가면
 *     banner/contentinfo 역할을 잃어 랜드마크가 0개가 된다 (WCAG 1.3.1).
 *  2) 툴을 히어로 직후로 올린다. AI 이미지 툴의 전환 패턴은 "설득 후 사용"이 아니라
 *     "사용 중 설득"이다 — 이전 순서에서는 유일한 전환 지점이 스크롤 59% 지점에 있었다.
 */
export default function Landing({ toolSlot }: { toolSlot: ReactNode }) {
  return (
    <div className="xp-landing">
      <a className="skip-link" href="#main-content">
        본문으로 바로 가기
      </a>
      <TopBar />
      <main id="main-content">
        <HeroHand />
        <ToolSection>{toolSlot}</ToolSection>
        <Gallery />
        <PriceSection />
        <Stats />
        <Services />
        <Testimonials />
        <Faq />
        <FooterCta />
      </main>
      <SiteFooter />
    </div>
  );
}
