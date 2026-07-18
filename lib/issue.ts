const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

export interface Issue {
  /** 발행호 번호 — 2026년 1월 = VOL.1 (창간 기준년) */
  vol: number;
  /** 오버라인 라벨, 예: "JULY 2026 — VOL.7" */
  label: string;
  /** 짧은 형식, 예: "JULY 2026" */
  monthLabel: string;
}

/** KST 기준 현재 발행호. "이달의 아트" 컨셉의 동적 장치. */
export function currentIssue(now: Date = new Date()): Issue {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth(); // 0-based
  const vol = Math.max(1, (year - 2026) * 12 + month + 1);
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  return { vol, label: `${monthLabel} — VOL.${vol}`, monthLabel };
}
