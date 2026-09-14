const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
] as const;

export interface Issue {
  /**
   * 달력에서 계산한 호수 — 2026년 1월 = 1.
   * 실제 발행 이력이 아니라 단순 계산값이므로 **사용자 화면에 노출하지 않는다.**
   * "VOL.8"처럼 보이면 8호까지 발행됐다는 거짓 이력으로 읽힌다.
   */
  vol: number;
  /** 오버라인 라벨, 예: "JULY 2026" */
  label: string;
  /** 짧은 형식, 예: "JULY 2026" */
  monthLabel: string;
  /** 한국어 호 표기, 예: "2026년 7월 호" */
  koLabel: string;
  /** 짧은 한국어 표기, 예: "7월 호" */
  koShort: string;
}

/** KST 기준 현재 발행호. "이달의 아트" 컨셉의 동적 장치. */
export function currentIssue(now: Date = new Date()): Issue {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth(); // 0-based
  const vol = Math.max(1, (year - 2026) * 12 + month + 1);
  const monthLabel = `${MONTH_NAMES[month]} ${year}`;
  return {
    vol,
    label: monthLabel,
    monthLabel,
    koLabel: `${year}년 ${month + 1}월 호`,
    koShort: `${month + 1}월 호`,
  };
}
