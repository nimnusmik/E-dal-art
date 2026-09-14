import { getDb } from './db';

/**
 * 계정 레코드 (Postgres).
 *
 * 세션은 여전히 쿠키(JWT)에 있다. 이 테이블은 "누가 가입했나"와 보관함 소유권만 담당한다.
 * 그래서 로그인 경로에서 DB가 잠깐 죽어도 로그인 자체는 계속 동작한다 — upsert 실패는
 * 삼키고, 다음 로그인 때 다시 시도된다. 인증(할 수 있나)과 기록(누구였나)을 분리해 두면
 * 저장소 장애가 로그인 장애로 번지지 않는다.
 */

export interface Account {
  id: string;
  email: string;
  marketingOk: boolean;
}

/**
 * 로그인 시 호출. 처음이면 만들고, 있으면 마지막 접속 시각과 이메일을 갱신한다.
 * (이메일은 구글에서 바뀔 수 있으므로 매번 최신값으로 덮는다. 계정의 기준은 google_sub.)
 */
export async function upsertAccount(googleSub: string, email: string): Promise<Account | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const rows = (await sql`
      insert into users (google_sub, email)
      values (${googleSub}, ${email})
      on conflict (google_sub) do update
        set email = excluded.email,
            last_seen_at = now()
      returning id, email, marketing_ok
    `) as Array<{ id: string; email: string; marketing_ok: boolean }>;
    const row = rows[0];
    return row ? { id: row.id, email: row.email, marketingOk: row.marketing_ok } : null;
  } catch {
    // 기록 실패가 로그인 실패가 되면 안 된다
    return null;
  }
}

/** google_sub → 내부 계정 id. 보관함 쿼리가 쓴다 */
export async function accountIdBySub(googleSub: string): Promise<string | null> {
  const sql = getDb();
  if (!sql) return null;
  try {
    const rows = (await sql`
      select id from users where google_sub = ${googleSub} limit 1
    `) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * 탈퇴 — 계정과 보관함을 즉시 완전 삭제한다.
 * designs는 on delete cascade라 함께 사라진다. 처리방침의 "지체 없이 파기"와 일치.
 */
export async function deleteAccount(googleSub: string): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  try {
    await sql`delete from users where google_sub = ${googleSub}`;
    return true;
  } catch {
    return false;
  }
}
