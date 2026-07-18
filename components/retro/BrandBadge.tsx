import { Starburst } from './Sparkles';

/** 크롬 그라디언트 로고 + 핑크 스타버스트 배지 (전 화면 공통 헤더) */
export default function BrandBadge() {
  return (
    <div className="brand-badge">
      <Starburst className="brand-star" />
      <span className="brand-chrome">이달아</span>
    </div>
  );
}
