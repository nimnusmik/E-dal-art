'use client';

import type { CSSProperties } from 'react';
import { STATS } from './content';
import { useReveal } from './useReveal';

/** 인트로 카피 + 제품 사실 카드 4장. 카드 모서리에 파스텔 블롭이 얹힌다. */
export default function Stats() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="xp-paper xp-stats" aria-label="이달아가 만드는 것">
      <div className="xp-head">
        <span className="xp-pill t-blue">About</span>
        <h2>
          기억에 남는 시안을
          <br />
          만들어요
        </h2>
        <p>
          영감 사진을 이달의 무드로 옮겨 담아요. 색과 구조가 다른 다섯 갈래를 한 번에 보고,
          마음에 든 시안만 손에 올려봐요.
        </p>
        <a className="xp-cta xp-cta-sm" href="#tool">
          시작하기
        </a>
      </div>
      <div className="xp-stat-grid" ref={ref}>
        {STATS.map((s, i) => (
          <article
            className={`xp-card xp-reveal blob-${s.tone}`}
            style={{ '--d': `${i * 90}ms` } as CSSProperties}
            key={s.label}
          >
            <span className="xp-stat-value">{s.value}</span>
            <h3>{s.label}</h3>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
