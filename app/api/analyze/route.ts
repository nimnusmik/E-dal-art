import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getQuota, ipQuotaKey, reserve, totalQuotaKey, userQuotaKey } from '@/lib/quota';
import { analyzeToBrief, applyOptions, planVariants } from '@/lib/brief';
import { clientIp, dailyLimits, paymentGate, quotaSubject } from '@/lib/request';
import { issueVariantToken } from '@/lib/variantToken';
import { AnalyzeBodySchema } from '@/lib/schemas';

/**
 * POST /api/analyze — 3종 변주 파이프라인 1단계 (docs/api-variants-contract.md).
 * 분석 1회 → 옵션 오버라이드 → 변주 플랜 3종. 세션 시작 = 기존 일일 크레딧 1 차감(성공 시에만).
 */

export const maxDuration = 60; // 분석 + 플랜 텍스트 호출 2회 + 여유

type AnalyzeErrorCode =
  | 'INVALID_INPUT'
  | 'LOGIN_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'RATE_LIMIT_USER'
  | 'RATE_LIMIT_TOTAL'
  | 'ANALYZE_FAILED';

function errorResponse(error: AnalyzeErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse('INVALID_INPUT', 400);
  }
  const parsed = AnalyzeBodySchema.safeParse(raw);
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400);
  const body = parsed.data;

  // 결제 게이트 — 이용권이 있어야 생성할 수 있다 (호출 1건이 곧 실비)
  const gate = await paymentGate();
  if (gate) return errorResponse(gate.error, gate.status);

  const store = getRedis();
  const ip = clientIp(req);
  const subject = await quotaSubject(req); // 로그인 시 계정, 아니면 IP
  const now = new Date();
  const { userLimit, totalLimit, ipLimit } = dailyLimits();

  // 선점 후 작업 — 조회 후 차감하면 분석에 걸리는 수십 초가 그대로 경쟁 조건 창이 된다
  const held = await reserve(
    store,
    [
      { key: userQuotaKey(subject, now), limit: userLimit, code: 'RATE_LIMIT_USER' },
      // 계정 한도만 두면 구글 계정을 갈아끼우는 만큼 뚫린다 — IP 층을 함께 건다
      { key: ipQuotaKey(ip, now), limit: ipLimit, code: 'RATE_LIMIT_USER' },
      { key: totalQuotaKey(now), limit: totalLimit, code: 'RATE_LIMIT_TOTAL' },
    ],
    now,
    { trackPending: true }, // 플랫폼 타임아웃/OOM 시 reaper가 환불한다
  );
  if (!held.ok) return errorResponse(held.code as AnalyzeErrorCode, 429);

  // 분석 실패 시 502 — 예약분을 환불해 "실패는 미차감" 규칙을 유지한다
  const rawBrief = await analyzeToBrief(body.images);
  if (!rawBrief) {
    await held.release();
    return errorResponse('ANALYZE_FAILED', 502);
  }

  // 쉐입·길이·파츠 강도는 손님 주문이 사진을 이긴다
  const brief = applyOptions(rawBrief, {
    shape: body.shape,
    length: body.length,
    partsIntensity: body.partsIntensity,
  });
  const plans = await planVariants(brief); // 실패 시 내부 폴백 — 항상 3개

  const quota = await getQuota(store, subject, now, userLimit, totalLimit);
  // 성공 확정 — pending 마커를 지우고 카운터는 유지한다
  await held.commit();
  return NextResponse.json({
    brief,
    plans,
    remaining: quota.userRemaining,
    // variant 호출용 세션 토큰 — analyze를 거치지 않은 직접 호출을 막는다
    variantToken: issueVariantToken(subject, now),
  });
}
