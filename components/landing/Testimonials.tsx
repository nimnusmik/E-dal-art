'use client';

import type { CSSProperties } from 'react';
import { SCENES } from './content';
import { useReveal } from './useReveal';

/**
 * 예상 사용 장면 카드 3장.
 * 실제 고객 후기가 아니므로 섹션 설명에 그 사실을 반드시 남긴다.
 */
export default function Testimonials() {
  const ref = useReveal<HTMLDivElement>(0.12);
  return (
    <section className="xp-paper xp-scenes" aria-label="이렇게 쓰여요">
      <div className="xp-head">
        <span className="xp-pill t-pink">Scenes</span>
        <h2>이렇게 쓰여요</h2>
        <p>아직 출시 전이라 실제 후기 대신, 이달아가 그리는 사용 장면을 적었어요.</p>
      </div>
      <div className="xp-scene-stack" ref={ref}>
        {SCENES.map((s, i) => (
          <article
            className="xp-card xp-scene xp-reveal"
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            key={s.persona}
          >
            <header className="xp-scene-head">
              <span className="xp-scene-avatar" aria-hidden>
                {s.persona.slice(0, 1)}
              </span>
              <span>
                <strong>{s.persona}</strong>
                <em>{s.role}</em>
              </span>
            </header>
            <blockquote>"{s.quote}"</blockquote>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
