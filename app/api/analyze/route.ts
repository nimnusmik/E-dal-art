import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getQuota, reserve, totalQuotaKey, userQuotaKey } from '@/lib/quota';
import { analyzeToBrief, applyOptions, planVariants } from '@/lib/brief';
import { clientIp, dailyLimits, isNailLength, isNailShape, parseImages } from '@/lib/request';
import type { ImagePayload, NailLength, NailShape, PartsIntensity } from '@/lib/types';

/**
 * POST /api/analyze — 5종 변주 파이프라인 1단계 (docs/api-variants-contract.md).
 * 분석 1회 → 옵션 오버라이드 → 변주 플랜 5종. 세션 시작 = 기존 일일 크레딧 1 차감(성공 시에만).
 */

export const maxDuration = 60; // 분석 + 플랜 텍스트 호출 2회 + 여유

const PARTS_INTENSITIES: PartsIntensity[] = ['auto', 'none', 'point', 'rich'];

type AnalyzeErrorCode = 'INVALID_INPUT' | 'RATE_LIMIT_USER' | 'RATE_LIMIT_TOTAL' | 'ANALYZE_FAILED';

interface AnalyzeRequest {
  images: ImagePayload[];
  shape: NailShape;
  length: NailLength;
  partsIntensity: PartsIntensity;
}

function errorResponse(error: AnalyzeErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateBody(body: unknown): AnalyzeRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { images, shape, length, partsIntensity } = body as Record<string, unknown>;
  const parsedImages = parseImages(images);
  if (!parsedImages) return null;
  if (!isNailShape(shape) || !isNailLength(length)) return null;
  if (!PARTS_INTENSITIES.includes(partsIntensity as PartsIntensity)) return null;
  return { images: parsedImages, shape, length, partsIntensity: partsIntensity as PartsIntensity };
}

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse('INVALID_INPUT', 400);
  }
  const body = validateBody(raw);
  if (!body) return errorResponse('INVALID_INPUT', 400);

  const store = getRedis();
  const ip = clientIp(req);
  const now = new Date();
  const { userLimit, totalLimit } = dailyLimits();

  // 선점 후 작업 — 조회 후 차감하면 분석에 걸리는 수십 초가 그대로 경쟁 조건 창이 된다
  const held = await reserve(
    store,
    [
      { key: userQuotaKey(ip, now), limit: userLimit, code: 'RATE_LIMIT_USER' },
      { key: totalQuotaKey(now), limit: totalLimit, code: 'RATE_LIMIT_TOTAL' },
    ],
    now,
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
  const plans = await planVariants(brief); // 실패 시 내부 폴백 — 항상 5개

  const quota = await getQuota(store, ip, now, userLimit, totalLimit);
  return NextResponse.json({ brief, plans, remaining: quota.userRemaining });
}

/** 남은 횟수 조회 (차감 없음) — 시작 화면 표시용, 기존 GET /api/generate와 동일 로직 */
export async function GET(req: Request): Promise<NextResponse> {
  const { userLimit, totalLimit } = dailyLimits();
  const quota = await getQuota(getRedis(), clientIp(req), new Date(), userLimit, totalLimit);
  return NextResponse.json({ remaining: quota.userRemaining });
}
