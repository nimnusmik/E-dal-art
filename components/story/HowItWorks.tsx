'use client';

import type { CSSProperties } from 'react';
import { useReveal } from './hooks';

const STEPS = [
  {
    num: '01',
    head: '영감 사진을 올려요',
    body: '스크린샷, 좋아하는 옷, 오늘의 하늘. 무엇이든 시작이 돼요. 최대 3장까지.',
  },
  {
    num: '02',
    head: 'AI가 이달의 트렌드를 입혀요',
    body: '글레이즈드 광택, 크롬 시머, 3D 파츠 — 지금 유행하는 K-네일 무드로 시안을 만들어요.',
  },
  {
    num: '03',
    head: '마음에 들 때까지 진화',
    body: '사진을 더할수록 디자인이 진화해요. 완성되면 시안 카드로 저장하세요.',
  },
];

/** 매거진 목차식 3컬럼 — 헤어라인 + 세리프 넘버링, 스크롤 진입 시 스태거 reveal */
export default function HowItWorks() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="story-hiw" aria-label="어떻게 작동하나요">
      <div className="section-head">
        <p className="overline">How It Works</p>
        <h2 className="section-title">시안이 만들어지는 과정</h2>
      </div>
      <div className="hiw-grid" ref={ref}>
        {STEPS.map((s, i) => (
          <div
            className="hiw-col reveal"
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            key={s.num}
          >
            <span className="hiw-num">{s.num}</span>
            <h3>{s.head}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
