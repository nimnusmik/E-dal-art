'use client';

import { useEffect, useState } from 'react';
import { extractVividColors } from '@/lib/collage';
import type { TrayPhoto, VariantSlot } from '@/app/page';
import '@/app/studio.css';

/**
 * 생성 중 화면 — 결과 화면(Studio)과 같은 3단 틀 (2026-10-27 개편).
 * 넘어갈 때 레이아웃이 그대로라 "기다림 → 결과"가 한 화면이 채워지는 것처럼 읽힌다.
 * 왼쪽 레일 = 시안 칸이 완성순으로 채워짐 / 가운데 = 영감 사진 부채꼴 + 스캔 빛 / 오른쪽 = 진행 단계.
 */

// 1단계(사진 분석) 동안 순환하는 문구 — analyze는 ~10초라 짧게 돈다
const ANALYZE_MESSAGES = [
  'Reading the colors in your photos...',
  'Studying charms and techniques...',
  'Planning your looks...',
];

/**
 * 이 시점을 넘기면 "느려지고 있다"를 명시적으로 알린다.
 * 기준은 **총 소요**다 — 단계별 고정값이면 정상 케이스 한복판에서 경고가 터졌다.
 */
const SLOW_AFTER_S = 75;

/** 총 소요 약속 — 단계마다 재견적하면 예산이 도중에 늘어나 이탈을 부른다 */
const TOTAL_ESTIMATE = 'Usually under a minute';

function useElapsedSeconds(): number {
  const [s, setS] = useState(0);
  useEffect(() => {
    const started = performance.now();
    const t = setInterval(() => setS(Math.floor((performance.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, []);
  return s;
}

async function urlToBitmap(url: string): Promise<ImageBitmap> {
  return createImageBitmap(await (await fetch(url)).blob());
}

export default function GeneratingScreen({
  stage,
  slots,
  photos,
  onRetry,
  onSelect,
  onCancel,
}: {
  /** analyzing: 사진 분석 중 / variants: 시안 3종이 완성순으로 도착 중 */
  stage: 'analyzing' | 'variants';
  slots: VariantSlot[];
  /** 올린 영감 사진 — 가운데 부채꼴과 배경 색에 쓴다 */
  photos: TrayPhoto[];
  onRetry: (planId: string) => void;
  onSelect: (planId: string) => void;
  /** 취소 — 사진과 옵션은 보존한 채 시작 화면으로 돌아간다 */
  onCancel: () => void;
}) {
  const [index, setIndex] = useState(0);
  const elapsed = useElapsedSeconds();
  const doneSlots = slots.filter((s) => s.status === 'done' && s.tipSet);
  const doneCount = doneSlots.length;
  const first = doneSlots[0] ?? null;

  /**
   * 낭독용 완료 개수는 1초 디바운스한다 — 몇십 ms 간격으로 갱신되면 스크린리더가
   * 큐를 쌓아 읽느라 다음 조작을 막는다. 시각 표시는 즉시, 낭독은 디바운스.
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

  // 배경 빛 번짐 — 영감 사진들의 선명한 색
  const [glow, setGlow] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    Promise.all(photos.slice(0, 3).map((p) => urlToBitmap(p.previewUrl).then((b) => extractVividColors(b, 2))))
      .then((lists) => { if (!cancelled) setGlow(lists.flat()); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [photos]);
  const g = [...glow, '#9fb8ff', '#f4b6d2', '#c8b6ff'].slice(0, 3);

  // 분석 중엔 아직 플랜이 없어 슬롯이 비어 있다 — 빈 칸 3개를 미리 보여준다
  const railSlots: Array<VariantSlot | null> = slots.length ? slots : [null, null, null];
  const no = (i: number) => String(i + 1).padStart(2, '0');

  const steps: Array<{ label: string; state: 'done' | 'active' | 'todo'; sub?: string }> = [
    { label: 'Reading your photos', state: stage === 'analyzing' ? 'active' : 'done', sub: stage === 'analyzing' ? ANALYZE_MESSAGES[index] : undefined },
    {
      label: 'Designing three looks',
      state: stage === 'analyzing' ? 'todo' : doneCount >= slots.length && slots.length > 0 ? 'done' : 'active',
      sub: stage === 'variants' ? `${doneCount} of ${slots.length} ready` : undefined,
    },
    { label: 'Quality check on every set', state: stage === 'analyzing' ? 'todo' : doneCount > 0 ? 'active' : 'todo' },
  ];

  return (
    <div className="st st-gen">
      <div
        className="st-bg"
        key={g.join()}
        style={{ ['--g1' as string]: g[0], ['--g2' as string]: g[1], ['--g3' as string]: g[2] }}
        aria-hidden
      />

      {/* 왼쪽 레일 — 완성되는 순서대로 채워진다. 완성된 칸은 바로 눌러서 볼 수 있다 */}
      <nav className="st-rail" aria-label="Your looks">
        <span className="st-rail-head">Looks</span>
        {railSlots.map((slot, i) => {
          if (slot && slot.status === 'done' && slot.tipSet) {
            return (
              <button
                key={slot.plan.id}
                className="st-thumb is-on st-pop"
                aria-label={`Look ${no(i)}: ${slot.plan.title}. Open`}
                onClick={() => onSelect(slot.plan.id)}
              >
                <img src={`data:${slot.tipSet.mimeType};base64,${slot.tipSet.image}`} alt="" />
                <span className="st-thumb-no" aria-hidden>{no(i)}</span>
              </button>
            );
          }
          if (slot && slot.status === 'error') {
            return (
              <div key={slot.plan.id} className="st-thumb is-fail">
                <span>
                  Couldn&apos;t draw
                  <br />
                  <button onClick={() => onRetry(slot.plan.id)}>Retry · free</button>
                </span>
              </div>
            );
          }
          if (slot && slot.status === 'stopped') {
            return <div key={slot.plan.id} className="st-thumb is-fail"><span>Daily limit</span></div>;
          }
          return <div key={slot?.plan.id ?? i} className="st-thumb is-pending" aria-hidden />;
        })}
      </nav>

      {/* 가운데 — 첫 시안이 나오면 그걸 크게, 그 전엔 영감 사진 부채꼴 위로 스캔 빛 */}
      <section className="st-stage" aria-label="Progress">
        {first?.tipSet ? (
          <button className="st-hero st-hero-btn" onClick={() => onSelect(first.plan.id)} aria-label={`Open ${first.plan.title}`}>
            <img src={`data:${first.tipSet.mimeType};base64,${first.tipSet.image}`} alt="" />
            <span className="st-hero-chip">First look is ready · tap to open</span>
          </button>
        ) : (
          <div className="st-fan" aria-hidden>
            {photos.slice(0, 3).map((p, i, arr) => (
              <div
                key={p.id}
                className="st-fan-card"
                style={{ ['--r' as string]: `${(i - (arr.length - 1) / 2) * 9}deg`, ['--x' as string]: `${(i - (arr.length - 1) / 2) * 34}%` }}
              >
                <img src={p.previewUrl} alt="" />
              </div>
            ))}
            <div className="st-scan" />
          </div>
        )}
        <div role="status" aria-live="polite" className="st-gen-msg">
          {stage === 'analyzing' ? (
            <span key={index}>{ANALYZE_MESSAGES[index]}</span>
          ) : (
            <span>Drawing your looks: {announced} of {slots.length}</span>
          )}
        </div>
      </section>

      {/* 오른쪽 — 진행 단계와 취소 */}
      <aside className="st-panel" aria-label="Steps">
        <div>
          <p className="st-eyebrow">{stage === 'analyzing' ? 'Now reading' : 'Now printing'}</p>
          <h2 className="st-title">Making your sets</h2>
        </div>
        <p className="st-note">Looks appear one by one as they finish. Tap any one as soon as it shows up.</p>

        <ol className="st-steps">
          {steps.map((s) => (
            <li key={s.label} className={`is-${s.state}`}>
              <span className="st-step-dot" aria-hidden>{s.state === 'done' ? '✓' : ''}</span>
              <span>
                {s.label}
                {s.sub && <small>{s.sub}</small>}
              </span>
            </li>
          ))}
        </ol>

        <div className="st-meta">
          <div>Estimate<b>{TOTAL_ESTIMATE.replace('Usually ', '')}</b></div>
          <div>Elapsed<b>{elapsed}s</b></div>
        </div>
        {elapsed >= SLOW_AFTER_S && (
          <p className="st-note" role="status" aria-live="polite">Taking a little longer. Please keep this screen open.</p>
        )}

        {/* 취소는 항상 보이는 자리에 — 기다리다 지친 사용자가 가장 찾는 버튼.
            취소해도 이미 선점된 1회는 돌아오지 않으므로 누르기 전에 밝힌다. */}
        <div className="st-actions">
          <button className="st-btn ghost" onClick={onCancel}>Cancel and go back</button>
          <p className="assurance" style={{ textAlign: 'center', margin: 0 }}>Canceling won&apos;t refund this run.</p>
        </div>
      </aside>
    </div>
  );
}
