'use client';

import type { CSSProperties } from 'react';
import RetroWindow from '@/components/retro/RetroWindow';
import { useReveal } from './hooks';

const STEPS = [
  {
    title: 'STEP_1.EXE',
    head: '영감 사진을 올려요',
    body: '스크린샷, 좋아하는 옷, 오늘의 하늘. 무엇이든 시작이 돼요. (최대 3장)',
  },
  {
    title: 'STEP_2.EXE',
    head: 'AI가 이달의 트렌드를 입혀요',
    body: '글레이즈드 광택, 크롬 시머, 3D 파츠 — 지금 유행하는 K-네일 무드로 시안을 만들어요.',
  },
  {
    title: 'STEP_3.EXE',
    head: '마음에 들 때까지 진화',
    body: '사진을 더할수록 디자인이 진화해요. 완성되면 시안 카드로 저장하세요.',
  },
];

/** RetroWindow 3장이 스크롤 진입 시 스태거 reveal 되는 섹션 */
export default function HowItWorks() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="story-hiw" aria-label="어떻게 작동하나요">
      <div className="hiw-grid" ref={ref}>
        {STEPS.map((s, i) => (
          <div
            className="reveal"
            style={{ '--d': `${i * 90}ms` } as CSSProperties}
            key={s.title}
          >
            <RetroWindow title={s.title} barClassName={i === 1 ? 'rwin-bar-blue' : ''}>
              <div className="hiw-body">
                <h3>{s.head}</h3>
                <p>{s.body}</p>
              </div>
            </RetroWindow>
          </div>
        ))}
      </div>
    </section>
  );
}
