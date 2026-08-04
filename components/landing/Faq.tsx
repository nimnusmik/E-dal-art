'use client';

import type { CSSProperties } from 'react';
import { FAQS } from './content';
import { useReveal } from './useReveal';

/** 산개 배치 FAQ 필 — 좌우 엇갈리게 흩뿌린다 */
export default function Faq() {
  const ref = useReveal<HTMLUListElement>();
  return (
    <section className="xp-paper xp-faq" aria-label="자주 묻는 질문">
      <div className="xp-head">
        <span className="xp-pill t-green">FAQ</span>
        <h2>시작하기 전에</h2>
      </div>
      <ul className="xp-faq-list" ref={ref}>
        {FAQS.map((f, i) => (
          <li
            className={`xp-reveal xp-faq-item i${i % 3}`}
            style={{ '--d': `${i * 70}ms` } as CSSProperties}
            key={f.q}
          >
            <span className={`xp-pill t-${f.tone}`}>{f.q}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
