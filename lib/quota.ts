import { kstDateKey, secondsUntilKstMidnight } from './kst';

export interface CounterStore {
  get(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface QuotaStatus {
  userUsed: number;
  totalUsed: number;
  userRemaining: number;
  totalExhausted: boolean;
}

const TTL_BUFFER_SECONDS = 60;

function userKey(ip: string, date: string): string {
  return `quota:user:${ip}:${date}`;
}

function totalKey(date: string): string {
  return `quota:total:${date}`;
}

export async function getQuota(
  store: CounterStore,
  ip: string,
  now: Date,
  userLimit: number,
  totalLimit: number,
): Promise<QuotaStatus> {
  const date = kstDateKey(now);
  const [u, t] = await Promise.all([store.get(userKey(ip, date)), store.get(totalKey(date))]);
  const userUsed = Number(u ?? 0);
  const totalUsed = Number(t ?? 0);
  return {
    userUsed,
    totalUsed,
    userRemaining: Math.max(0, userLimit - userUsed),
    totalExhausted: totalUsed >= totalLimit,
  };
}

/** 생성 성공 후에만 호출 — 실패 시 차감 없음 규칙의 구현 지점 */
export async function recordGeneration(store: CounterStore, ip: string, now: Date): Promise<void> {
  const date = kstDateKey(now);
  const ttl = secondsUntilKstMidnight(now) + TTL_BUFFER_SECONDS;
  const uKey = userKey(ip, date);
  const tKey = totalKey(date);
  await store.incr(uKey);
  await store.expire(uKey, ttl);
  await store.incr(tKey);
  await store.expire(tKey, ttl);
}

/** 범위별 일일 카운터 — variant·hero 등 엔드포인트 전용 쿼터 (기존 user/total 카운터와 키 공간 분리) */
export type QuotaScope = 'variant' | 'hero';

function scopedKey(scope: QuotaScope, ip: string, date: string): string {
  return `quota:${scope}:${ip}:${date}`;
}

/** 오늘(KST) 해당 범위의 사용량 조회 */
export async function getScopedUsage(
  store: CounterStore,
  scope: QuotaScope,
  ip: string,
  now: Date,
): Promise<number> {
  const v = await store.get(scopedKey(scope, ip, kstDateKey(now)));
  return Number(v ?? 0);
}

/** 범위별 카운터 증가 — 생성 성공 후에만 호출 (실패 시 차감 없음 규칙 동일 적용) */
export async function recordScoped(
  store: CounterStore,
  scope: QuotaScope,
  ip: string,
  now: Date,
): Promise<void> {
  const key = scopedKey(scope, ip, kstDateKey(now));
  const ttl = secondsUntilKstMidnight(now) + TTL_BUFFER_SECONDS;
  await store.incr(key);
  await store.expire(key, ttl);
}

export async function recordMetric(
  store: CounterStore,
  event: 'save' | 'evolve' | 'share' | 'notify',
  now: Date,
): Promise<void> {
  await store.incr(`metric:${event}:${kstDateKey(now)}`);
}
