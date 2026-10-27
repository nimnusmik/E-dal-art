import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { imageQuotaKey, reserve, scopedQuotaKey } from '@/lib/quota';
import { dailyLimits, quotaSubject } from '@/lib/request';
import { verifyVariantToken } from '@/lib/variantToken';
import { TryOnBodySchema } from '@/lib/schemas';
import { NoNailsError, tryOn } from '@/lib/tryon';

/**
 * POST /api/tryon — 사용자가 올린 손 사진에 고른 팁셋을 입힌다 (SAM 3.1 + Muse Image, lib/tryon.ts).
 * 보안·쿼터는 /api/hero와 같은 구조: variantToken 세션 바인딩 + 세션당 상한 + 전역 이미지 카운터.
 * 성공 시에만 차감, 실패하면 환불.
 */

export const maxDuration = 60; // Muse Image 약 20초 + SAM + 합성

/** 세션 1회당 입혀보기 상한 — 원가: Muse $0.01 + SAM $0.0025, 원가보다 남용 방지용 */
const TRYON_LIMIT_PER_SESSION = 3;

type TryOnErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TOKEN'
  | 'RATE_LIMIT_TRYON'
  | 'RATE_LIMIT_TOTAL'
  | 'NO_NAILS'
  | 'GENERATION_FAILED';

function errorResponse(error: TryOnErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request): Promise<NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorResponse('INVALID_INPUT', 400);
  }
  const parsed = TryOnBodySchema.safeParse(raw);
  if (!parsed.success) return errorResponse('INVALID_INPUT', 400);
  const body = parsed.data;

  const store = getRedis();
  const subject = await quotaSubject(req);
  const now = new Date();
  const { imageLimit } = dailyLimits();

  const sid = verifyVariantToken(body.variantToken, subject, now);
  if (!sid) return errorResponse('INVALID_TOKEN', 400);

  const held = await reserve(
    store,
    [
      { key: scopedQuotaKey('tryon', sid, now), limit: TRYON_LIMIT_PER_SESSION, code: 'RATE_LIMIT_TRYON' },
      { key: imageQuotaKey(now), limit: imageLimit, code: 'RATE_LIMIT_TOTAL' },
    ],
    now,
    { trackPending: true },
  );
  if (!held.ok) return errorResponse(held.code as TryOnErrorCode, 429);

  try {
    const image = await tryOn(body.hand, { data: body.tipSet.image, mimeType: body.tipSet.mimeType });
    await held.commit();
    return NextResponse.json({ tryon: { image: image.data, mimeType: image.mimeType } });
  } catch (e) {
    await held.release();
    // 손톱을 못 찾은 건 사용자가 고칠 수 있는 문제 — 다른 사진을 올리라고 안내하게 따로 알린다
    if (e instanceof NoNailsError) return errorResponse('NO_NAILS', 422);
    return errorResponse('GENERATION_FAILED', 502);
  }
}
