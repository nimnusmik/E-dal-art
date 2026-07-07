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

export async function recordMetric(
  store: CounterStore,
  event: 'save' | 'evolve',
  now: Date,
): Promise<void> {
  await store.incr(`metric:${event}:${kstDateKey(now)}`);
}
