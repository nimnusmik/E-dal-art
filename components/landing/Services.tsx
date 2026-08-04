'use client';

import type { CSSProperties } from 'react';
import { SERVICES } from './content';
import { useReveal } from './useReveal';

/** 이용 흐름 5행 — 참조의 서비스 리스트 자리. 각 행이 파스텔 필 하나. */
export default function Services() {
  const ref = useReveal<HTMLUListElement>();
  return (
    <section className="xp-paper xp-services" aria-label="이용 흐름">
      <div className="xp-head">
        <span className="xp-pill t-purple">Process</span>
        <h2>
          시안이 만들어지는
          <br />
          다섯 단계
        </h2>
      </div>
      <ul className="xp-service-list" ref={ref}>
        {SERVICES.map((s, i) => (
          <li
            className={`xp-service-row xp-reveal t-${s.tone}`}
            style={{ '--d': `${i * 80}ms` } as CSSProperties}
            key={s.no}
          >
            <span className="xp-service-no">{s.no}</span>
            <span className="xp-service-label">{s.label}</span>
            <span className="xp-service-arrow" aria-hidden>→</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
