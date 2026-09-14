/**
 * 결과 화면의 새로고침 복구.
 *
 * 이전에는 persistence가 0건이라 새로고침 한 번에 결과가 전소되고 크레딧 1회가
 * 그냥 날아갔다. sessionStorage에만 담으므로 탭을 닫으면 사라진다 —
 * FAQ의 "탭을 닫으면 사라져요"와 동작이 일치한다.
 */
const KEY = 'idala:result:v1';

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

export function loadSnapshot<S, M>(): ResumeSnapshot<S, M> | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ResumeSnapshot<S, M>;
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
