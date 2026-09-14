import { neon } from '@neondatabase/serverless';

/**
 * Postgres (Neon) 접근 레이어.
 *
 * 역할 분담을 명확히 한다 — 두 저장소를 쓰는 이유:
 *   Upstash Redis : 사라져도 되는 것 (일일 쿼터 카운터, 지표). 자정에 스스로 소멸.
 *   Postgres      : 사라지면 안 되는 것 (계정, 보관한 시안). 트랜잭션·백업 있음.
 *
 * ORM을 쓰지 않는다. 테이블이 두 개뿐이고 쿼리가 열 줄 남짓이라, 마이그레이션 도구와
 * 스키마 DSL을 들이는 비용이 얻는 것보다 크다. 쿼리가 스무 개를 넘어가면 그때 재검토.
 *
 * 모든 쿼리는 태그드 템플릿(sql`...`)으로만 쓴다 — 값이 자동으로 파라미터화되어
 * SQL 인젝션이 구조적으로 막힌다. 문자열을 이어붙여 쿼리를 만들지 말 것.
 */

/** DB가 아직 연결되지 않은 환경(로컬 초기 개발 등)에서는 null을 돌려 호출부가 건너뛰게 한다 */
function connectionString(): string | null {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL_UNPOOLED ??
    null
  );
}

export function dbAvailable(): boolean {
  return connectionString() !== null;
}

type SqlClient = ReturnType<typeof neon>;
let client: SqlClient | null = null;

/** DB 핸들. 연결 정보가 없으면 null — 호출부는 반드시 이 경우를 처리해야 한다 */
export function getDb(): SqlClient | null {
  if (client) return client;
  const url = connectionString();
  if (!url) return null;
  client = neon(url);
  return client;
}
