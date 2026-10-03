import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { imageQuotaKey, reserve, scopedQuotaKey } from '@/lib/quota';
import { buildPrompt } from '@/lib/prompt';
import { getTrendKeywords } from '@/config/trends';
import { generateImage } from '@/lib/provider';
import { clientIp, dailyLimits, paymentGate, quotaSubject } from '@/lib/request';
import { HeroBodySchema } from '@/lib/schemas';
import type { ImagePayload, NailLength, NailShape } from '@/lib/types';

/**
 * POST /api/hero — 유저가 고른 팁셋으로 착용샷 온디맨드 생성 (docs/api-variants-contract.md).
 * 기존 buildPrompt(hasTipReference=true) 경로 재사용.
 * 쿼터: 별도 hero 일일 카운터 (상한 = DAILY_USER_LIMIT × 5). 성공 시에만 차감.
 */

export const maxDuration = 60; // 생성 1장 + 여유

const HERO_LIMIT_MULTIPLIER = 5;

type HeroErrorCode =
  | 'INVALID_INPUT'
  | 'LOGIN_REQUIRED'
  | 'PAYMENT_REQUIRED'
  | 'RATE_LIMIT_HERO'
  | 'RATE_LIMIT_TOTAL'
  | 'REJECTED'
  | 'GENERATION_FAILED';

interface HeroRequest {
  images: ImagePayload[];
  tipSet: { image: string; mimeType: string };
  shape: NailShape;
  length: NailLength;
}

function errorResponse(error: HeroErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateBody(body: unknown): HeroRequest | null {
  const parsed = HeroBodySchema.safeParse(body);
  return parsed.success ? parsed.data : null;
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

  // 결제 게이트 — 이용권이 있어야 생성할 수 있다 (호출 1건이 곧 실비)
  const gate = await paymentGate();
  if (gate) return errorResponse(gate.error, gate.status);

  const store = getRedis();
  const subject = await quotaSubject(req);
  const now = new Date();
  const { userLimit, imageLimit } = dailyLimits();

  // variant와 같은 전역 이미지 카운터를 공유한다 — 모든 생성 경로가 하나의 지출 상한 아래
  const held = await reserve(
    store,
    [
      {
        key: scopedQuotaKey('hero', subject, now),
        limit: userLimit * HERO_LIMIT_MULTIPLIER,
        code: 'RATE_LIMIT_HERO',
      },
      { key: imageQuotaKey(now), limit: imageLimit, code: 'RATE_LIMIT_TOTAL' },
    ],
    now,
    { trackPending: true }, // 플랫폼 타임아웃/OOM 시 reaper가 환불한다
  );
  if (!held.ok) return errorResponse(held.code as HeroErrorCode, 429);

  // 팁셋 이미지를 참조로 넘겨 손톱이 팁과 같은 디자인이 되게 함 (기존 generate 2단계와 동일)
  const refs: ImagePayload[] = [
    ...body.images,
    { data: body.tipSet.image, mimeType: body.tipSet.mimeType },
  ];
  const prompt = buildPrompt(body.shape, body.length, getTrendKeywords(), body.images.length, true);

  let outcome;
  try {
    outcome = await generateImage(refs, prompt);
  } catch {
    await held.release();
    return errorResponse('GENERATION_FAILED', 502);
  }
  if (!outcome.image) {
    await held.release();
    return errorResponse(outcome.safetyBlocked ? 'REJECTED' : 'GENERATION_FAILED', outcome.safetyBlocked ? 422 : 502);
  }

  // 성공 확정 — pending 마커를 지우고 카운터는 유지한다
  await held.commit();
  return NextResponse.json({
    hero: { image: outcome.image.data, mimeType: outcome.image.mimeType },
  });
}
