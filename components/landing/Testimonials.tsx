'use client';

import type { CSSProperties } from 'react';
import { SCENES } from './content';
import { useReveal } from './useReveal';

/**
 * 예상 사용 장면 카드 3장.
 * 실제 고객 후기가 아니므로 섹션 설명에 그 사실을 반드시 남긴다.
 */
export default function Testimonials() {
  const ref = useReveal<HTMLUListElement>(0.12);
  return (
    // 초원 배경으로 둔 이유: 이 앞뒤로 paper 섹션이 4개 연속(페이지의 47%, 모바일
    // 4400px)이라 "끝이 안 보이는 회백색 구간"이 생겼다. Scenes가 그중 가장 짧고
    // 감성 콘텐츠라, 여기서 리듬을 끊으면 paper–사진–paper가 된다.
    <section className="xp-meadow xp-scenes" aria-label="이렇게 쓰여요">
      <div className="xp-head xp-head-on-photo">
        <span className="xp-pill t-pink" aria-hidden>Scenes</span>
        <h2>이렇게 쓰여요</h2>
        <p>아직 출시 전이라 실제 후기 대신, 이달아가 그리는 사용 장면을 적었어요.</p>
      </div>
      <ul className="xp-scene-stack" role="list" ref={ref}>
        {SCENES.map((s, i) => (
          <li
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
            {/* 따옴표는 CSS ::before/::after — JSX 리터럴로 두면 별개 텍스트 노드가 되어
                스크린리더가 "왼쪽 큰따옴표"를 읽는다 */}
            <blockquote>{s.quote}</blockquote>
            <p>{s.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
