'use client';

import { useStickyProgress } from './hooks';

const LOOKS = [
  {
    src: '/samples/showcase-1.webp',
    num: 'LOOK 01',
    name: '글레이즈드 리프레인',
    keywords: '글레이즈드 · 펄 파츠',
  },
  {
    src: '/samples/showcase-2.webp',
    num: 'LOOK 02',
    name: '크롬 오로라',
    keywords: '크롬 · 시머',
  },
  {
    src: '/samples/showcase-3.webp',
    num: 'LOOK 03',
    name: '시럽 레이어',
    keywords: '시럽 · 그라데이션',
  },
];

/**
 * 이번 호의 룩 — 세로 스크롤이 가로 이동으로 변환되는 룩북.
 * 모바일·reduced-motion은 CSS만으로 세로 스택 폴백.
 */
export default function Showcase() {
  const ref = useStickyProgress<HTMLDivElement>();
  return (
    <section className="story-showcase" aria-label="이번 호 샘플 룩">
      <div className="showcase-wrap" ref={ref}>
        <div className="showcase-sticky">
          <div className="showcase-heading">
            <p className="overline">From This Issue</p>
            <h2 className="section-title">이번 호의 룩</h2>
          </div>
          <div className="showcase-track">
            {LOOKS.map((look) => (
              <figure className="showcase-panel" key={look.src}>
                <img
                  src={look.src}
                  alt={`${look.name} — ${look.keywords}`}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="showcase-caption">
                  <p className="overline">{look.num}</p>
                  <p className="look-name">{look.name}</p>
                  <p className="look-keywords">{look.keywords}</p>
                </figcaption>
              </figure>
            ))}
            <div className="showcase-panel showcase-next">
              <p>
                다음 페이지는,
                <br />
                당신의 차례
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
