import Marquee from '@/components/retro/Marquee';
import { DEFAULT_TREND_KEYWORDS } from '@/config/trends';

export default function StoryFooter() {
  return (
    <footer className="story-footer">
      <Marquee items={DEFAULT_TREND_KEYWORDS} />
      <p className="footer-credit">이달아 © 2026 — AI가 만드는 이달의 네일</p>
    </footer>
  );
}
