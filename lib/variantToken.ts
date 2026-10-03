import { createHmac, timingSafeEqual } from 'node:crypto';
import { kstDateKey } from './kst';

/**
 * variant 세션 토큰 — /api/analyze 성공 시 발급, /api/variant가 검증한다.
 *
 * 목적: variant가 analyze를 거치지 않고 직접 호출되는 것을 막는다.
 * analyze는 일일 크레딧(세션)을 차감하므로, 이 토큰이 있어야만
 * "세션 1건 → variant 최대 N회"라는 쿼터 모델이 성립한다.
 *
 * 토큰 = base64url({sub, day}) + '.' + HMAC-SHA256. 당일·동일 주체에만 유효하다.
 * AUTH_SECRET은 next-auth용으로 이미 필수이므로 서명 키로 재사용한다.
 * 로컬 개발(AUTH_SECRET 없음)에서는 고정 폴백 키를 쓴다 — 개발용 토큰이
 * 운영에서 통할 일은 없다(운영은 AUTH_SECRET 필수).
 */

function secret(): string {
  return process.env.AUTH_SECRET ?? 'idala-dev-only-not-a-secret';
}

export function issueVariantToken(subject: string, now: Date): string {
  const payload = Buffer.from(JSON.stringify({ sub: subject, day: kstDateKey(now) })).toString('base64url');
  const sig = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyVariantToken(token: unknown, subject: string, now: Date): boolean {
  if (typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  let parsed: { sub?: unknown; day?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (parsed.sub !== subject || parsed.day !== kstDateKey(now)) return false;
  const sig = Buffer.from(token.slice(dot + 1), 'utf8');
  const expected = Buffer.from(createHmac('sha256', secret()).update(payload).digest('base64url'), 'utf8');
  return sig.length === expected.length && timingSafeEqual(sig, expected);
}
