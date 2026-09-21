'use client';

import type { CSSProperties } from 'react';
import { SERVICES } from './content';
import { useReveal } from './useReveal';

/**
 * 이용 흐름 5행.
 * 이전에는 각 행이 알약(999px) + 그림자 + 우측 `→` 화살표라 누구나 버튼으로 읽었지만
 * 실제로는 클릭되지 않는 리스트였다. 화살표를 걷고 chip 형태로 내리고,
 * 접을 이유가 없는 설명 한 줄을 항상 펼쳐 둔다.
 * 색은 무지개 5색이 아니라 단일 색조 명도 계단(--step-1..5)으로 진행 방향을 만든다.
 */
export default function Services() {
  const ref = useReveal<HTMLUListElement>();
  return (
    <section className="xp-paper xp-services" aria-label="이용 흐름">
      <div className="xp-head">
        <span className="xp-pill t-purple" aria-hidden>Process</span>
        <h2>
          시안이 만들어지는
          <br />
          다섯 단계
        </h2>
      </div>
      {/* list-style:none이 붙은 ul은 Safari/VoiceOver에서 리스트 의미를 잃는다 */}
      <ul className="xp-service-list" role="list" ref={ref}>
        {SERVICES.map((s, i) => (
          <li
            className={`xp-service-row xp-reveal s${i + 1}`}
            style={{ '--d': `${i * 80}ms` } as CSSProperties}
            key={s.no}
          >
            <span className="xp-service-no">{s.no}</span>
            <span className="xp-service-label">{s.label}</span>
            <p className="xp-service-body">{s.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
