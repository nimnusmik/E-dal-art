'use client';

import type { CSSProperties } from 'react';
import { GALLERY } from './content';
import { useReveal } from './useReveal';

/**
 * 초원 배경 위 폴라로이드 시안 카드.
 * 맥 트래픽 라이트 3점은 걷어냈다 — CSS 주석이 선언한 Windows XP 컨셉과
 * 정반대 OS 신호여서 두 레퍼런스가 서로를 지웠고, 네일 사진에 브라우저 크롬이
 * 붙을 이유도 없었다. 은유는 "인쇄된 사진" 하나로 정리한다.
 */
export default function Gallery() {
  const ref = useReveal<HTMLUListElement>(0.12);
  return (
    <section className="xp-meadow xp-gallery" aria-label="시안 예시">
      <div className="xp-head xp-head-on-photo">
        <span className="xp-pill t-yellow">Looks</span>
        <h2 className="xp-display">이런 시안이 나와요</h2>
        <p>실제로 만들어 검수를 통과한 시안이에요. 영감 사진은 섞지 않았어요.</p>
      </div>
      <ul className="xp-polaroids" role="list" ref={ref}>
        {GALLERY.map((g, i) => (
          <li
            className="xp-polaroid-slot xp-reveal"
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            key={g.src}
          >
            <figure
              className="xp-polaroid"
              style={{ '--tilt': `${g.tilt}deg` } as CSSProperties}
            >
              <img src={g.src} alt={`시안 예시 — ${g.title}`} width={320} height={320} loading="lazy" decoding="async" />
              <figcaption>
                <strong>{g.title}</strong>
                <span>{g.meta}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}
