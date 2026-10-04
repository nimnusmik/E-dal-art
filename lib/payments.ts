import { getDb } from './db';

/**
 * 횟수권 (Postgres users.credits + payments).
 *
 * 스키마 설계 규칙 그대로 — 카드번호·생년월일 같은 것은 절대 들어오지 않고,
 * PG사 참조(stripe_session_id)와 지급한 횟수만 둔다.
 * 탈퇴하면 행이 통째로 지워지므로 결제 기록도 함께 파기된다.
 */

export { PACK_CREDITS, PRICE_EARLY_KRW, PRICE_REGULAR_KRW } from './pricing';
import { PACK_CREDITS } from './pricing';

/** 남은 횟수. DB가 없거나 실패하면 0 — "열려 있는" 쪽으로 실패하지 않는다 */
export async function creditsBySub(googleSub: string): Promise<number> {
  const sql = getDb();
  if (!sql) return 0;
  try {
    const rows = (await sql`
      select credits from users where google_sub = ${googleSub} limit 1
    `) as Array<{ credits: number }>;
    return rows[0]?.credits ?? 0;
  } catch {
    return 0;
  }
}

/**
 * 1회 차감 — 원자적이다. 남은 횟수가 없으면 null.
 * 조회 후 차감하면 동시 요청 두 개가 마지막 1회를 함께 쓴다 — where credits > 0이 막는다.
 */
export async function takeCredit(googleSub: string): Promise<number | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const rows = (await sql`
      update users set credits = credits - 1
      where google_sub = ${googleSub} and credits > 0
      returning credits
    `) as Array<{ credits: number }>;
    return rows[0]?.credits ?? null;
  } catch {
    return null;
  }
}

/** 생성 실패 시 환불 — "실패는 미차감" */
export async function refundCredit(googleSub: string): Promise<void> {
  const sql = getDb();
  if (!sql) return;
  try {
    await sql`update users set credits = credits + 1 where google_sub = ${googleSub}`;
  } catch {
    // ponytail: 환불 실패는 삼킨다(손님 1회 손해). 잦아지면 재시도 큐로
  }
}

export interface MarkPaidInput {
  googleSub: string;
  email: string;
  sessionId: string;
}

/**
 * checkout.session.completed 처리 — 멱등이다.
 *
 * Stripe는 webhook을 "최소 1회" 전달하고 /pay/success 폴백도 같은 세션을 처리한다.
 * payments의 기본키(세션 id) 삽입이 성공한 경우에만 횟수를 더하므로, 몇 번이 와도
 * 결제 1건 = PACK_CREDITS회다. 두 문장은 한 트랜잭션이다.
 */
export async function markPaid(input: MarkPaidInput): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    await sql.transaction([
      // 로그인 때 보통 이미 만들어져 있지만, 없으면 만든다
      sql`
        insert into users (google_sub, email) values (${input.googleSub}, ${input.email})
        on conflict (google_sub) do nothing
      `,
      sql`
        with p as (
          insert into payments (stripe_session_id, user_id, credits)
          select ${input.sessionId}, id, ${PACK_CREDITS} from users where google_sub = ${input.googleSub}
          on conflict (stripe_session_id) do nothing
          returning user_id, credits
        )
        update users set credits = users.credits + p.credits, last_seen_at = now()
        from p where users.id = p.user_id
      `,
    ]);
    return true;
  } catch {
    return false;
  }
}
