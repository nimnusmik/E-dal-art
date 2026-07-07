const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** KST 기준 날짜키 YYYYMMDD */
export function kstDateKey(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
}

/** KST 자정까지 남은 초 (Redis TTL용) */
export function secondsUntilKstMidnight(now: Date): number {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  const nextMidnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() + 1);
  return Math.round((nextMidnight - kst.getTime()) / 1000);
}
