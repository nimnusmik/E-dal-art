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
    // 카드에 role="listitem"을 직접 붙이면 button의 암묵 역할이 덮여
    // "버튼"으로 낭독되지 않고 aria-pressed(선택 상태)도 무효가 된다.
    // 목록 시맨틱은 li가 갖고, 버튼은 버튼으로 둔다.
    <ul className="variant-grid" aria-label="시안 5종">
      {slots.map((slot, i) => {
        const no = String(i + 1).padStart(2, '0');

        if (slot.status === 'done' && slot.tipSet) {
          const selected = slot.plan.id === selectedId;
          const note = slot.plan.note;
          return (
            <li key={slot.plan.id}>
              <button
                className={`variant-card${selected ? ' selected' : ''}`}
                aria-pressed={selected}
                onClick={() => onSelect?.(slot.plan.id)}
              >
                {/* 캡션이 제목을 이미 주므로 이미지는 장식 처리 — 중복 낭독 방지 */}
                <img src={`data:${slot.tipSet.mimeType};base64,${slot.tipSet.image}`} alt="" />
                <span className="variant-no" aria-hidden>{no}</span>
                <span className="variant-caption">
                  <span className="variant-title">
                    시안 {no} — {slot.plan.title}
                  </span>
                  {/* 무엇이 다른 시안인지 한 줄로 — 이름만 있으면 무작위 단어 5개로 읽힌다 */}
                  {note && <span className="variant-note">{note}</span>}
                  {slot.quality?.pass === false && (
                    <span className="variant-badge warn">아쉬운 컷</span>
                  )}
                </span>
              </button>
            </li>
          );
        }

        if (slot.status === 'error') {
          return (
            <li key={slot.plan.id}>
              <div className="variant-card is-fail">
                <div className="variant-fail">
                  <span className="variant-fail-msg">생성 실패</span>
                  {onRetry && (
                    <button className="btn-outline variant-retry" onClick={() => onRetry(slot.plan.id)}>
                      다시 시도 · 무료
                    </button>
                  )}
                </div>
                <span className="variant-no" aria-hidden>{no}</span>
              </div>
            </li>
          );
        }

        if (slot.status === 'stopped') {
          return (
            <li key={slot.plan.id}>
              <div className="variant-card is-fail">
                <div className="variant-fail">
                  <span className="variant-fail-msg">오늘 한도 도달</span>
                  <span className="variant-fail-sub">내일 다시 그려드릴게요</span>
                </div>
                <span className="variant-no" aria-hidden>{no}</span>
              </div>
            </li>
          );
        }

        // pending — 스켈레톤
        return (
          <li key={slot.plan.id}>
            <div className="variant-card is-pending">
              <div className="variant-skeleton" aria-hidden />
              <span className="variant-no" aria-hidden>{no}</span>
              <span className="variant-caption">
                <span className="variant-title">{slot.plan.title}</span>
                <span className="variant-badge soft">그리는 중</span>
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
