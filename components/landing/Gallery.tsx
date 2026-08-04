'use client';

import type { CSSProperties } from 'react';
import { GALLERY } from './content';
import { useReveal } from './useReveal';

/** 초원 배경 위 폴라로이드 시안 카드 — 맥 창 점 3개가 얹힌 브라우저 카드 모양 */
export default function Gallery() {
  const ref = useReveal<HTMLDivElement>(0.12);
  return (
    <section className="xp-meadow xp-gallery" aria-label="시안 예시">
      <div className="xp-head xp-head-on-photo">
        <span className="xp-pill t-yellow">Looks</span>
        <h2 className="xp-display">이런 시안이 나와요</h2>
      </div>
      <div className="xp-polaroids" ref={ref}>
        {GALLERY.map((g, i) => (
          <div
            className="xp-polaroid-slot xp-reveal"
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            key={g.src}
          >
            <figure
              className="xp-polaroid"
              style={{ '--tilt': `${g.tilt}deg` } as CSSProperties}
            >
              <div className="xp-polaroid-bar" aria-hidden>
                <i /><i /><i />
              </div>
              <img src={g.src} alt={`시안 예시 — ${g.title}`} width={320} height={320} loading="lazy" decoding="async" />
              <figcaption>
                <strong>{g.title}</strong>
                <span>{g.meta}</span>
              </figcaption>
            </figure>
          </div>
        ))}
      </div>
    </section>
  );
}
