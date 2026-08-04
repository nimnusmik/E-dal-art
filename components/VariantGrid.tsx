'use client';

import type { VariantSlot } from '@/app/page';

/**
 * 시안 5종 그리드 — 생성 화면(스트리밍)과 결과 화면(선택)이 공유.
 * pending: 스켈레톤 / done: 이미지 카드(선택 가능) / error: 슬롯 단위 재시도 / stopped: 한도 안내
 */
export default function VariantGrid({
  slots,
  selectedId = null,
  onSelect,
  onRetry,
}: {
  slots: VariantSlot[];
  selectedId?: string | null;
  onSelect?: (planId: string) => void;
  onRetry?: (planId: string) => void;
}) {
  return (
    <div className="variant-grid" role="list" aria-label="시안 5종">
      {slots.map((slot, i) => {
        const no = String(i + 1).padStart(2, '0');

        if (slot.status === 'done' && slot.tipSet) {
          const selected = slot.plan.id === selectedId;
          return (
            <button
              key={slot.plan.id}
              role="listitem"
              className={`variant-card${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect?.(slot.plan.id)}
            >
              <img
                src={`data:${slot.tipSet.mimeType};base64,${slot.tipSet.image}`}
                alt={`시안 ${no} — ${slot.plan.title}`}
              />
              <span className="variant-no" aria-hidden>{no}</span>
              <span className="variant-caption">
                <span className="variant-title">{slot.plan.title}</span>
                {/* 검수 통과만 뱃지 강조 — 낙제작은 은은한 표기 */}
                {slot.quality?.pass === true && <span className="variant-badge">검수 통과</span>}
                {slot.quality?.pass === false && (
                  <span className="variant-badge soft">아쉬운 컷</span>
                )}
              </span>
            </button>
          );
        }

        if (slot.status === 'error') {
          return (
            <div key={slot.plan.id} role="listitem" className="variant-card is-fail">
              <div className="variant-fail">
                <span className="variant-fail-msg">생성 실패</span>
                {onRetry && (
                  <button className="btn-outline variant-retry" onClick={() => onRetry(slot.plan.id)}>
                    다시 시도
                  </button>
                )}
              </div>
              <span className="variant-no" aria-hidden>{no}</span>
            </div>
          );
        }

        if (slot.status === 'stopped') {
          return (
            <div key={slot.plan.id} role="listitem" className="variant-card is-fail">
              <div className="variant-fail">
                <span className="variant-fail-msg">오늘 한도 도달</span>
                <span className="variant-fail-sub">내일 다시 그려드릴게요</span>
              </div>
              <span className="variant-no" aria-hidden>{no}</span>
            </div>
          );
        }

        // pending — 스켈레톤
        return (
          <div key={slot.plan.id} role="listitem" className="variant-card is-pending">
            <div className="variant-skeleton" aria-hidden />
            <span className="variant-no" aria-hidden>{no}</span>
            <span className="variant-caption">
              <span className="variant-title">{slot.plan.title}</span>
              <span className="variant-badge soft">그리는 중</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
