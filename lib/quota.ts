import { kstDateKey, secondsUntilKstMidnight } from './kst';

export interface CounterStore {
  get(key: string): Promise<unknown>;
  incr(key: string): Promise<number>;
  decr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<unknown>;
}

export interface QuotaStatus {
  userUsed: number;
  totalUsed: number;
  userRemaining: number;
  totalExhausted: boolean;
}

const TTL_BUFFER_SECONDS = 60;

/** 범위별 일일 카운터 — variant·hero 등 엔드포인트 전용 쿼터 (user/total과 키 공간 분리) */
export type QuotaScope = 'variant' | 'hero';

/**
 * 쿼터 주체 키. subject는 로그인 시 `u:<구글sub>`, 비로그인 시 `ip:<주소>`다
 * (lib/request.ts quotaSubject). 접두사를 붙이는 이유는 키 공간 충돌 방지 —
 * 없으면 어떤 계정 식별자가 어떤 IP 문자열과 우연히 같아져 쿼터를 나눠 쓸 수 있다.
 */
export function userQuotaKey(subject: string, now: Date): string {
  return `quota:user:${subject}:${kstDateKey(now)}`;
}

export function totalQuotaKey(now: Date): string {
  return `quota:total:${kstDateKey(now)}`;
}

export function scopedQuotaKey(scope: QuotaScope, subject: string, now: Date): string {
  return `quota:${scope}:${subject}:${kstDateKey(now)}`;
}

/**
 * 전역 이미지 생성 카운터 — 하루 지출의 실질적 상한.
 *
 * user/total 카운터는 "세션 수"를 세지만 비용은 세션이 아니라 **생성한 이미지 장수**에
 * 비례한다(세션 1건 = 변주 5장 + 착용샷 N장). 이 키가 없으면 variant·hero가
 * IP별 한도만 통과하면 되므로 IP를 갈아끼우는 만큼 비용이 선형으로 늘어난다.
 * 모든 이미지 생성 경로가 이 하나의 카운터를 공유해 "우회당해도 하루 상한은 고정"을 만든다.
 */
export function imageQuotaKey(now: Date): string {
  return `quota:image:${kstDateKey(now)}`;
}

/**
 * IP별 일일 상한 — 계정 한도와 **함께** 건다.
 *
 * 로그인을 붙였다고 IP 한도를 지우면 안 된다. 구글 계정은 무료로 무제한 생성할 수
 * 있어서, 계정 한도만 있으면 계정을 갈아끼우는 만큼 이미지가 뽑히고 그게 그대로 카드값이
 * 된다. 방어는 세 겹이어야 한다:
 *   1층 계정(userQuotaKey) — 정상 사용자의 과다 사용
 *   2층 IP(여기) — 계정 갈아끼우기
 *   3층 전역 이미지(imageQuotaKey) — 1·2층이 다 뚫려도 하루 지출의 절대 상한
 */
export function ipQuotaKey(ip: string, now: Date): string {
  return `quota:ipday:${ip}:${kstDateKey(now)}`;
}

export async function getQuota(
  store: CounterStore,
  subject: string,
  now: Date,
  userLimit: number,
  totalLimit: number,
): Promise<QuotaStatus> {
  const [u, t] = await Promise.all([
    store.get(userQuotaKey(subject, now)),
    store.get(totalQuotaKey(now)),
  ]);
  const userUsed = Number(u ?? 0);
  const totalUsed = Number(t ?? 0);
  return {
    userUsed,
    totalUsed,
    userRemaining: Math.max(0, userLimit - userUsed),
    totalExhausted: totalUsed >= totalLimit,
  };
}

/** 오늘(KST) 해당 범위의 사용량 조회 */
export async function getScopedUsage(
  store: CounterStore,
  scope: QuotaScope,
  subject: string,
  now: Date,
): Promise<number> {
  const v = await store.get(scopedQuotaKey(scope, subject, now));
  return Number(v ?? 0);
}

export interface QuotaRequest {
  /** 카운터 키 */
  key: string;
  /** 이 키의 일일 상한 */
  limit: number;
  /** 한도 초과 시 라우트가 반환할 에러 코드 */
  code: string;
}

export type ReserveResult =
  | { ok: true; release: () => Promise<void> }
  | { ok: false; code: string };

/**
 * 카운터를 원자적으로 선점한다 (예약 → 작업 → 실패 시 환불).
 *
 * 기존 구조는 "조회 → (수십 초 외부 API) → 증가"라서, 그 사이에 같은 IP가 병렬로
 * 요청을 쏟으면 전부 같은 잔여값을 보고 통과했다. 창이 수십 초라 curl 몇 줄로 한도를
 * 무력화할 수 있었다. INCR은 원자적이므로 "먼저 올리고, 넘었으면 되돌린다"로 뒤집으면
 * 경쟁 조건 자체가 사라진다. 생성 실패 시 release()로 환불해 "실패는 미차감" 규칙은 유지한다.
 *
 * 여러 키를 한 번에 예약하며, 하나라도 한도를 넘으면 이미 올린 것을 전부 되돌린다.
 */
export async function reserve(
  store: CounterStore,
  requests: QuotaRequest[],
  now: Date,
): Promise<ReserveResult> {
  const ttl = secondsUntilKstMidnight(now) + TTL_BUFFER_SECONDS;
  const taken: string[] = [];

  const rollback = async (): Promise<void> => {
    // 환불은 실패해도 되돌릴 방법이 없다 — 삼키되 카운터가 과다 계상되는 쪽(안전)으로 남는다
    await Promise.allSettled(taken.map((key) => store.decr(key)));
  };

  for (const { key, limit, code } of requests) {
    const count = await store.incr(key);
    taken.push(key);
    // 첫 증가에서만 TTL을 건다 (매번 걸면 자정 만료가 계속 밀린다)
    if (count === 1) await store.expire(key, ttl);
    if (count > limit) {
      await rollback();
      return { ok: false, code };
    }
  }

  return { ok: true, release: rollback };
}

export async function recordMetric(
  store: CounterStore,
  event: MetricEvent,
  now: Date,
): Promise<void> {
  await store.incr(`metric:${event}:${kstDateKey(now)}`);
}

/**
 * save/evolve/share는 익명 카운터, notify·price는 검증 신호.
 * price = 결과 화면의 유료 구독 버튼 클릭 — 승인된 검증 설계의 "가짜 가격 버튼" 게이트
 * (방문 200 기준 클릭률 3% 미만이면 B2C 트랙 킬)의 분자에 해당한다.
 */
export const METRIC_EVENTS = ['save', 'evolve', 'share', 'notify', 'price'] as const;
export type MetricEvent = (typeof METRIC_EVENTS)[number];
