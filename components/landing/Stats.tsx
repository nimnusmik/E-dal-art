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
        {/* 이전 헤드라인("기억에 남는 시안을 만들어요")은 어떤 제품이든 할 수 있는
            말이라 정보량이 0이었고, 본문은 히어로 부제를 리라이팅한 반복이었다.
            대신 사용자의 현재 대안(핀터레스트 스크랩)을 지목한다. */}
        <h2>
          핀터레스트에 저장만 해둔
          <br />
          그 디자인, 손에 올려봐요
        </h2>
        <p>스크랩은 남의 손이에요. 이달아는 색과 구조를 다시 짜서 손에 올린 모습까지 만들어요.</p>
      </div>
      <div className="xp-stat-grid" ref={ref}>
        {STATS.map((s, i) => (
          <article
            className={`xp-card xp-reveal blob-${s.tone}`}
            style={{ '--d': `${i * 90}ms` } as CSSProperties}
            key={s.label}
          >
            {/* 숫자를 h3 안에 넣어 스크린리더에서 값과 제목이 끊기지 않게 한다 —
                이전에는 "5종"이 h3 앞 떠도는 텍스트로 낭독됐다 */}
            <h3>
              <span className="xp-stat-value">{s.value}</span>
              {s.label}
            </h3>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
