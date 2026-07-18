'use client';

import RetroWindow from '@/components/retro/RetroWindow';
import { useStickyProgress } from './hooks';

const PANELS = [
  { src: '/samples/showcase-1.webp', title: 'SAMPLE_01.JPG', chips: ['글레이즈드', '펄 파츠'] },
  { src: '/samples/showcase-2.webp', title: 'SAMPLE_02.JPG', chips: ['크롬', '시머'] },
  { src: '/samples/showcase-3.webp', title: 'SAMPLE_03.JPG', chips: ['시럽', '그라데이션'] },
];

/**
 * 세로 스크롤 → 가로 이동 쇼케이스 (sticky + translateX).
 * 모바일·reduced-motion에서는 CSS만으로 세로 스택 폴백.
 */
export default function Showcase() {
  const ref = useStickyProgress<HTMLDivElement>();
  return (
    <section className="story-showcase" aria-label="이번 달 샘플 시안">
      <div className="showcase-wrap" ref={ref}>
        <div className="showcase-sticky">
          <h2 className="showcase-heading">이번 달, 이런 시안이 나왔어요</h2>
          <div className="showcase-track">
            {PANELS.map((p) => (
              <figure className="showcase-panel" key={p.src}>
                <img
                  src={p.src}
                  alt={`샘플 네일 시안 — ${p.chips.join(', ')}`}
                  loading="lazy"
                  decoding="async"
                />
                <figcaption className="showcase-caption">
                  <RetroWindow title={p.title}>
                    <div className="showcase-chips">
                      {p.chips.map((c) => (
                        <span className="chip" key={c}>
                          {c}
                        </span>
                      ))}
                    </div>
                  </RetroWindow>
                </figcaption>
              </figure>
            ))}
            <div className="showcase-panel showcase-next">
              <p>다음은 당신 차례예요 →</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
