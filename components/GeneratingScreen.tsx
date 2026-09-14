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

/** 이 시점을 넘기면 "느려지고 있다"를 명시적으로 알린다 (API maxDuration은 60초) */
const SLOW_AFTER_S = 30;

function useElapsedSeconds(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const t = setInterval(() => setS(Math.floor((performance.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return s;
}

export default function GeneratingScreen({
  stage,
  slots,
  onRetry,
  onSelect,
  onCancel,
}: {
  /** analyzing: 사진 분석 중 / variants: 시안 5종이 완성순으로 도착 중 */
  stage: 'analyzing' | 'variants';
  slots: VariantSlot[];
  onRetry: (planId: string) => void;
  onSelect: (planId: string) => void;
  /** 취소 — 사진과 옵션은 보존한 채 시작 화면으로 돌아간다 */
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const elapsed = useElapsedSeconds();

  useEffect(() => {
    if (stage !== 'analyzing') return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ANALYZE_MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, [stage]);

  /**
   * 진행률 바는 인디터미네이트다. 이전에는 14초 고정 CSS 애니메이션으로 4%→96%를
   * 채웠는데 API maxDuration은 60초라, 바가 96%에서 얼어붙은 채 최대 46초를 더
   * 기다렸다. 그건 "진행 중"이 아니라 "고장"으로 읽혔다. 남은 시간을 모를 때는
   * 진행률을 그리지 말고 경과 시간과 기대 범위를 정직하게 보여준다.
   */
  const meta = (
    <>
      <div className="progress-track" aria-hidden>
        <div className="progress-fill" />
      </div>
      <p className="progress-meta" aria-hidden>
        보통 {stage === 'analyzing' ? '10~20초' : '30~60초'} 걸려요 · {elapsed}초 경과
      </p>
      {elapsed >= SLOW_AFTER_S && (
        <p className="progress-slow" role="status" aria-live="polite">
          조금 더 걸리고 있어요. 화면을 닫지 말아주세요.
        </p>
      )}
      <button className="btn-link" onClick={onCancel}>
        취소하고 돌아가기
      </button>
    </>
  );

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
        {meta}
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
      {meta}
    </div>
  );
}
