'use client';

import { useEffect, useState } from 'react';
import VariantGrid from '@/components/VariantGrid';
import type { VariantSlot } from '@/app/page';

// 1단계(사진 분석) 동안 순환하는 문구 — analyze는 ~10초라 짧게 돈다
const ANALYZE_MESSAGES = [
  '사진의 색감을 읽는 중...',
  '파츠와 기법을 살피는 중...',
  '다섯 가지 변주를 구상하는 중...',
];

export default function GeneratingScreen({
  stage,
  slots,
  onRetry,
  onSelect,
}: {
  /** analyzing: 사진 분석 중 / variants: 시안 5종이 완성순으로 도착 중 */
  stage: 'analyzing' | 'variants';
  slots: VariantSlot[];
  onRetry: (planId: string) => void;
  onSelect: (planId: string) => void;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (stage !== 'analyzing') return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ANALYZE_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, [stage]);

  // 1단계 — 사진 분석 중
  if (stage === 'analyzing') {
    return (
      <div className="generating">
        <p className="overline">Now Reading</p>
        <div role="status" aria-live="polite">
          <p className="generating-msg" key={index}>
            {ANALYZE_MESSAGES[index]}
          </p>
        </div>
        <div className="progress-track" aria-hidden>
          <div className="progress-fill" />
        </div>
      </div>
    );
  }

  // 2단계 — 시안 5종 그리는 중: 완성되는 순서대로 슬롯이 채워진다
  const doneCount = slots.filter((s) => s.status === 'done').length;
  return (
    <div className="generating generating-variants">
      <p className="overline">Now Printing</p>
      <div role="status" aria-live="polite">
        <p className="generating-msg">
          시안 5종 그리는 중 — {doneCount}/{slots.length}
        </p>
      </div>
      <p className="sub generating-hint">
        완성되는 순서대로 나타나요. 먼저 나온 시안은 바로 눌러볼 수 있어요
      </p>
      <VariantGrid slots={slots} onSelect={onSelect} onRetry={onRetry} />
    </div>
  );
}
