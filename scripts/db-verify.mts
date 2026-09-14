/** 스키마·연결 확인용 일회성 점검 (npm run db:verify) */
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL!);

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
console.log('테이블:', tables.map((r) => r.table_name).join(', '));

const cols = await sql`
  select column_name from information_schema.columns
  where table_name = 'designs' order by ordinal_position
`;
console.log('designs 컬럼:', cols.map((r) => r.column_name).join(', '));

const users = await sql`select count(*)::int as n from users`;
const designs = await sql`select count(*)::int as n from designs`;
console.log(`행 수 — users: ${users[0].n}, designs: ${designs[0].n}`);
