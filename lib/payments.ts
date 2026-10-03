import { getDb } from './db';

/**
 * 결제 기록 (Postgres users 테이블).
 *
 * 스키마 설계 규칙 그대로 — 카드번호·생년월일 같은 것은 절대 들어오지 않고,
 * PG사 참조(stripe_customer_id, stripe_session_id)와 결제 시각(paid_at)만 둔다.
 * 탈퇴하면 행이 통째로 지워지므로 결제 기록도 함께 파기된다.
 */

/** 화면에 보여줄 가격 (원). 실제 과금은 Stripe Price가 하지만, 표시와 과금이
 *  갈라지면 안 되므로 바꾸면 STRIPE_PRICE_ID·쿠폰도 함께 바꾼다. */
export const PRICE_REGULAR_KRW = 9900;
/** 얼리버드 실결제액 = 정가 − 쿠폰(5000원) */
export const PRICE_EARLY_KRW = 4900;

/** 구글 sub 기준 이용권 보유 여부 */
export async function isPaidBySub(googleSub: string): Promise<boolean> {
  const sql = getDb();
  // DB가 없으면 미결제로 간주 — 생성 라우트가 막으므로 "열려 있는" 쪽으로
  // 실패하지 않는다
  if (!sql) return false;
  try {
    const rows = (await sql`
      select paid_at from users where google_sub = ${googleSub} limit 1
    `) as Array<{ paid_at: string | null }>;
    return rows[0]?.paid_at != null;
  } catch {
    return false;
  }
}

export interface MarkPaidInput {
  googleSub: string;
  email: string;
  customerId: string;
  sessionId: string;
}

/**
 * checkout.session.completed 처리 — 멱등이다.
 *
 * Stripe는 webhook을 "최소 1회" 전달한다. 같은 세션이 두 번 와도 paid_at은
 * 처음 값(coalesce)을 유지하고, 다른 세션이 와도 이미 찍힌 시각을 덮지 않는다.
 * webhook과 /pay/success 폴백이 동시에 달려도 결과는 같다.
 */
export async function markPaid(input: MarkPaidInput): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    await sql`
      insert into users (google_sub, email, stripe_customer_id, stripe_session_id, paid_at)
      values (${input.googleSub}, ${input.email}, ${input.customerId}, ${input.sessionId}, now())
      on conflict (google_sub) do update set
        stripe_customer_id = excluded.stripe_customer_id,
        stripe_session_id = excluded.stripe_session_id,
        paid_at = coalesce(users.paid_at, excluded.paid_at),
        email = excluded.email,
        last_seen_at = now()
    `;
    return true;
  } catch {
    return false;
  }
}
