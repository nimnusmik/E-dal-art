import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getScopedUsage, recordScoped } from '@/lib/quota';
import { applyPlan, buildBriefPrompt, parseBrief, parseVariantPlan } from '@/lib/brief';
import { judgeImage, verdict } from '@/lib/judge';
import { generateImage } from '@/lib/provider';
import { clientIp, dailyLimits, parseImages } from '@/lib/request';
import type { NailBrief } from '@/lib/brief';
import type { ImagePayload, VariantPlan } from '@/lib/types';

/**
 * POST /api/variant — 플랜 1개 → 팁셋 1장 생성 + 검수 1회 (docs/api-variants-contract.md).
 * variant당 재시도 없음 — 5종 병렬이 곧 다양성이므로 낙제작은 quality.pass=false로 표시만.
 * 쿼터: 별도 variant 일일 카운터 (상한 = DAILY_USER_LIMIT × 6). 성공 시에만 차감.
 */

export const maxDuration = 60; // 생성 1장 + 검수 1회 + 여유

const VARIANT_LIMIT_MULTIPLIER = 6;

type VariantErrorCode = 'INVALID_INPUT' | 'RATE_LIMIT_VARIANT' | 'REJECTED' | 'GENERATION_FAILED';

interface VariantRequest {
  images: ImagePayload[];
  brief: NailBrief;
  plan: VariantPlan;
}

function errorResponse(error: VariantErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateBody(body: unknown): VariantRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { images, brief, plan } = body as Record<string, unknown>;
  const parsedImages = parseImages(images);
  if (!parsedImages) return null;
  // parseBrief는 JSON 텍스트를 받으므로 재직렬화로 재사용 (구조·enum 검증 동일)
  const parsedBrief = parseBrief(JSON.stringify(brief ?? null));
  if (!parsedBrief) return null;
  const parsedPlan = parseVariantPlan(plan);
  if (!parsedPlan) return null;
  return { images: parsedImages, brief: parsedBrief, plan: parsedPlan };
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
  const limit = dailyLimits().userLimit * VARIANT_LIMIT_MULTIPLIER;

  const used = await getScopedUsage(store, 'variant', ip, now);
  if (used >= limit) return errorResponse('RATE_LIMIT_VARIANT', 429);

  // 플랜을 브리프에 병합 → 팁셋 1장 생성
  const merged = applyPlan(body.brief, body.plan);
  let outcome;
  try {
    outcome = await generateImage(body.images, buildBriefPrompt(merged));
  } catch {
    return errorResponse('GENERATION_FAILED', 502);
  }
  if (!outcome.image) {
    return errorResponse(outcome.safetyBlocked ? 'REJECTED' : 'GENERATION_FAILED', outcome.safetyBlocked ? 422 : 502);
  }

  // 검수 1회 — 실패(null)해도 이미지는 반환 (quality: null)
  const judgement = await judgeImage(outcome.image, merged);
  const quality = judgement ? verdict(judgement, merged) : null;

  await recordScoped(store, 'variant', ip, now); // 성공 시에만 차감

  return NextResponse.json({
    tipSet: { image: outcome.image.data, mimeType: outcome.image.mimeType },
    quality,
  });
}
