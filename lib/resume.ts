/**
 * 결과 화면의 새로고침 복구.
 *
 * 이전에는 persistence가 0건이라 새로고침 한 번에 결과가 전소되고 크레딧 1회가
 * 그냥 날아갔다. sessionStorage에만 담으므로 탭을 닫으면 사라진다 —
 * FAQ의 "탭을 닫으면 사라져요"와 동작이 일치한다.
 *
 * 복구 스냅샷은 **완성된 시안만** 담는다. 브리프·원본 사진은 담지 않으므로(용량)
 * 복구 후에는 재생성·재시도·착용샷을 할 수 없다. 그 버튼들을 그대로 두면 눌러도
 * 아무 일이 없거나 카드가 영영 스켈레톤으로 남으므로, 복구본은 읽기 전용으로 표시한다.
 */
/**
 * 스키마가 바뀌면 반드시 버전을 올린다.
 * v1 → v2: quality가 {pass, score}에서 QualityReport(issues·notes 포함)로 바뀜.
 * 옛 스냅샷을 그대로 되살리면 issues가 undefined라 결과 화면이 통째로 크래시했다.
 */
const KEY = 'idala:result:v2';

/** base64 이미지가 들어가므로 용량 상한을 넘기면 저장을 포기한다(조용히) */
const MAX_BYTES = 4_000_000;

export interface ResumeSnapshot<S, M> {
  slots: S;
  selectedId: string | null;
  mood: M;
  shape: string;
  length: string;
  partsIntensity: string;
  savedAt: number;
}

/** 스냅샷에 담을 수 있는 슬롯 — 최소 구조만 요구한다 */
interface SlotLike {
  plan: { id: string };
  status: string;
  tipSet: unknown;
}

export function saveSnapshot<S, M>(snap: Omit<ResumeSnapshot<S, M>, 'savedAt'>): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const json = JSON.stringify({ ...snap, savedAt: Date.now() });
    if (json.length > MAX_BYTES) return;
    sessionStorage.setItem(KEY, json);
  } catch {
    // 용량 초과·프라이빗 모드 — 복구는 편의 기능이므로 실패를 삼킨다
  }
}

/**
 * 저장된 슬롯 배열인지 확인한다.
 *
 * JSON.parse 결과를 그대로 캐스팅하면, 스키마가 바뀐 옛 스냅샷이나 손상 데이터에서
 * slot.plan.id 접근이 TypeError가 되어 결과 화면이 통째로 흰 화면이 된다.
 */
function isSlotArray(value: unknown): value is SlotLike[] {
  return (
    Array.isArray(value) &&
    value.every((s) => {
      if (typeof s !== 'object' || s === null) return false;
      const slot = s as Record<string, unknown>;
      const plan = slot.plan as Record<string, unknown> | undefined;
      return typeof plan?.id === 'string' && typeof slot.status === 'string';
    })
  );
}

/**
 * 복구본을 읽는다. 완성되지 않은 슬롯(pending/error)은 버린다 —
 * 되살려도 재시도할 브리프가 없어 영영 로딩으로 남기 때문.
 * 남는 시안이 없으면 복구할 것이 없는 것으로 본다.
 */
export function loadSnapshot<S extends SlotLike[], M>(): ResumeSnapshot<S, M> | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const snap = parsed as Record<string, unknown>;
    if (!isSlotArray(snap.slots)) return null;

    const usable = snap.slots.filter((s) => s.status === 'done' && s.tipSet);
    if (usable.length === 0) return null;

    // 버려진 슬롯이 선택돼 있었다면 선택도 무효화한다
    const selectedId =
      typeof snap.selectedId === 'string' && usable.some((s) => s.plan.id === snap.selectedId)
        ? snap.selectedId
        : null;

    return {
      slots: usable as S,
      selectedId,
      mood: (snap.mood ?? null) as M,
      shape: typeof snap.shape === 'string' ? snap.shape : 'almond',
      length: typeof snap.length === 'string' ? snap.length : 'medium',
      partsIntensity: typeof snap.partsIntensity === 'string' ? snap.partsIntensity : 'auto',
      savedAt: typeof snap.savedAt === 'number' ? snap.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}
