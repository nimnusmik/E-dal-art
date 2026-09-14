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

/**
 * 이 시점을 넘기면 "느려지고 있다"를 명시적으로 알린다.
 *
 * 기준은 **총 소요**다. 이전에는 30초 고정이었는데, 분석이 자기가 말한 정상 범위(10~20초)만
 * 써도 변주 단계 정상 구간 한복판에서 경고가 터졌다("보통 30~60초 걸려요" 바로 밑에
 * "조금 더 걸리고 있어요"가 동시에 뜸). 불안을 줄이려던 장치가 정상 케이스에서 불안을 만들었다.
 */
const SLOW_AFTER_S = 75;

/** 총 소요 약속 — 단계마다 재견적하면 예산이 도중에 늘어나 이탈을 부른다 */
const TOTAL_ESTIMATE = '보통 1분 안에 끝나요';

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
  const doneCount = slots.filter((s) => s.status === 'done').length;

  /**
   * 낭독용 완료 개수는 1초 디바운스한다.
   * 실측에서 1/5 → 3/5 → 4/5가 74ms 안에 갱신됐는데, 라이브 리전이 그때마다 발화하면
   * 스크린리더가 큐를 쌓아 읽느라 다음 조작을 막는다. 시각 표시는 즉시(doneCount),
   * 낭독은 디바운스(announced)로 분리한다.
   */
  const [announced, setAnnounced] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(doneCount), 1000);
    return () => clearTimeout(t);
  }, [doneCount]);

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
        {stage === 'analyzing' ? '1/2 사진 읽는 중' : '2/2 시안 그리는 중'} · {TOTAL_ESTIMATE} ·{' '}
        {elapsed}초 경과
      </p>
      {elapsed >= SLOW_AFTER_S && (
        <p className="progress-slow" role="status" aria-live="polite">
          조금 더 걸리고 있어요. 화면을 닫지 말아주세요.
        </p>
      )}
    </>
  );

  /**
   * 취소는 항상 폴드 안에 둔다 — 변주 단계에서 meta를 그리드 뒤에 두면 스켈레톤 5장에
   * 밀려 390px 화면에서 y=945(뷰포트 844)로 내려갔다. 기다리다 지친 사용자가 가장
   * 필요로 하는 버튼이 가장 안 보이는 자리에 있었다.
   * 문구: 취소해도 이미 선점된 1회는 돌아오지 않으므로 누르기 전에 밝힌다.
   */
  const cancel = (
    <div className="generating-cancel">
      <button className="btn-link" onClick={onCancel}>
        취소하고 돌아가기
      </button>
      <p className="assurance">취소해도 오늘 1회는 이미 사용됐어요.</p>
    </div>
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
        {cancel}
      </div>
    );
  }

  // 2단계 — 시안 5종 그리는 중: 완성되는 순서대로 슬롯이 채워진다
  return (
    <div className="generating generating-variants">
      <p className="overline">Now Printing</p>
      <div role="status" aria-live="polite">
        <p className="generating-msg">
          시안 5종 그리는 중 — {announced}/{slots.length}
        </p>
      </div>
      <p className="sub generating-hint">
        완성되는 순서대로 나타나요. 먼저 나온 시안은 바로 눌러볼 수 있어요
      </p>
      {meta}
      {cancel}
      <VariantGrid slots={slots} onSelect={onSelect} onRetry={onRetry} />
    </div>
  );
}
