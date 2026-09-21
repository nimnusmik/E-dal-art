'use client';

import type { CSSProperties } from 'react';
import { FAQS } from './content';
import { useReveal } from './useReveal';

/**
 * FAQ 카드.
 * 이전에는 질문 6개가 파스텔 알약으로 흩뿌려져 "누르라"고 손짓했지만 답변이
 * 데이터 모델에 아예 없었다. 답이 짧고 개수도 적으므로 접이식을 만들 이유가 없다 —
 * 질문과 답을 처음부터 함께 보인다. 클릭할 게 없으면 클릭 어포던스도 없어야 한다.
 */
export default function Faq() {
  const ref = useReveal<HTMLUListElement>(0.1);
  return (
    <section className="xp-paper xp-faq is-band-end" id="faq" aria-label="자주 묻는 질문">
      <div className="xp-head">
        <span className="xp-pill t-green" aria-hidden>FAQ</span>
        <h2>시작하기 전에</h2>
      </div>
      <ul className="xp-faq-list" role="list" ref={ref}>
        {FAQS.map((f, i) => (
          <li
            className="xp-faq-item xp-reveal"
            style={{ '--d': `${i * 60}ms` } as CSSProperties}
            key={f.q}
          >
            <h3 className="xp-faq-q">{f.q}</h3>
            <p className="xp-faq-a">{f.a}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
