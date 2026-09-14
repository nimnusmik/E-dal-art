/**
 * 스키마 적용 — db/schema.sql을 문장 단위로 실행한다.
 * 모든 문장이 멱등(create ... if not exists)이라 여러 번 돌려도 안전하다.
 *
 * 실행: npm run db:setup
 */
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL이 없습니다. .env.local을 확인하세요.');
  process.exit(1);
}

const sql = neon(url);
const raw = readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8');

// 주석 줄을 걷어내고 세미콜론으로 분리 (스키마에 함수 본문이 없어 이 단순 분리로 충분)
const statements = raw
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n')
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

for (const stmt of statements) {
  const label = stmt.replace(/\s+/g, ' ').slice(0, 64);
  await sql.query(stmt);
  console.log('✓', label);
}
console.log(`\n스키마 적용 완료 (${statements.length}개 문장)`);
