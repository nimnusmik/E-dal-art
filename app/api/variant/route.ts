import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { imageQuotaKey, reserve, scopedQuotaKey } from '@/lib/quota';
import { applyPlan, buildBriefPrompt, parseBrief, parseVariantPlan } from '@/lib/brief';
import { judgeImage, verdictDetail } from '@/lib/judge';
import { generateImage } from '@/lib/provider';
import { dailyLimits, quotaSubject } from '@/lib/request';
import { verifyVariantToken } from '@/lib/variantToken';
import { VariantBodySchema } from '@/lib/schemas';
import type { NailBrief } from '@/lib/brief';
import type { ImagePayload, VariantPlan } from '@/lib/types';

/**
 * POST /api/variant — 플랜 1개 → 팁셋 1장 생성 + 검수 1회 (docs/api-variants-contract.md).
 * 검수 낙제작만 1회 재생성해 더 나은 쪽을 반환. 그래도 낙제면 quality.pass=false로 표시만.
 * 쿼터: 세션(횟수권 1회)당 variant 카운터 (상한 6장, 재생성 포함). 성공 시에만 차감.
 */

export const maxDuration = 120; // 생성·검수 최대 2회 + 여유

/** 세션 1회당 시안 상한(재생성 포함) — 횟수권 1회의 원가 상한을 정한다 */
const VARIANT_LIMIT_PER_SESSION = 6;

type VariantErrorCode =
  | 'INVALID_INPUT'
  | 'INVALID_TOKEN'
  | 'RATE_LIMIT_VARIANT'
  | 'RATE_LIMIT_TOTAL'
  | 'REJECTED'
  | 'GENERATION_FAILED';

interface VariantRequest {
  images: ImagePayload[];
  brief: NailBrief;
  plan: VariantPlan;
  /** analyze가 발급한 세션 토큰 — 직접 호출 차단용 */
  variantToken: string;
}

function errorResponse(error: VariantErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateBody(body: unknown): VariantRequest | null {
  const parsed = VariantBodySchema.safeParse(body);
  if (!parsed.success) return null;
  // parseBrief는 JSON 텍스트를 받으므로 재직렬화로 재사용 (구조·enum 검증 동일)
  const parsedBrief = parseBrief(JSON.stringify(parsed.data.brief ?? null));
  if (!parsedBrief) return null;
  const parsedPlan = parseVariantPlan(parsed.data.plan);
  if (!parsedPlan) return null;
  return {
    images: parsed.data.images,
    brief: parsedBrief,
    plan: parsedPlan,
    variantToken: parsed.data.variantToken,
  };
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
  const subject = await quotaSubject(req);
  const now = new Date();
  const { imageLimit } = dailyLimits();

  // 세션 바인딩 — 횟수권을 차감한 analyze가 발급한 같은 주체의 토큰이 있어야 한다.
  // 이 토큰이 결제 게이트 역할을 한다 (analyze를 우회한 직접 POST 차단)
  const sid = verifyVariantToken(body.variantToken, subject, now);
  if (!sid) return errorResponse('INVALID_TOKEN', 400);

  // IP별 한도 + 전역 이미지 한도를 함께 선점한다. 전역 한도가 없으면 IP를 갈아끼우는
  // 만큼 비용이 선형으로 늘어난다 — 이 키가 하루 지출의 실질적 상한이다.
  const held = await reserve(
    store,
    [
      { key: scopedQuotaKey('variant', sid, now), limit: VARIANT_LIMIT_PER_SESSION, code: 'RATE_LIMIT_VARIANT' },
      { key: imageQuotaKey(now), limit: imageLimit, code: 'RATE_LIMIT_TOTAL' },
    ],
    now,
    { trackPending: true }, // 플랫폼 타임아웃/OOM 시 reaper가 환불한다
  );
  if (!held.ok) return errorResponse(held.code as VariantErrorCode, 429);

  // 플랜을 브리프에 병합 → 팁셋 1장 생성
  const merged = applyPlan(body.brief, body.plan);
  let outcome;
  try {
    outcome = await generateImage(body.images, buildBriefPrompt(merged));
  } catch {
    await held.release();
    return errorResponse('GENERATION_FAILED', 502);
  }
  if (!outcome.image) {
    await held.release();
    return errorResponse(outcome.safetyBlocked ? 'REJECTED' : 'GENERATION_FAILED', outcome.safetyBlocked ? 422 : 502);
  }

  // 검수 1회 — 실패(null)해도 이미지는 반환 (quality: null).
  // 심사평·미달 항목까지 함께 내보낸다: 배지 하나로는 "왜 아쉬운지"를 말할 수 없다.
  const judgement = await judgeImage(outcome.image, merged);
  let image = outcome.image;
  let quality = judgement ? verdictDetail(judgement, merged) : null;

  // 큰 변주는 크게 틀릴 확률도 높다 — 낙제작만 1회 재생성, 더 나은 쪽을 낸다.
  // 재시도도 이미지 1장이므로 사용자별·전역 한도를 다시 선점한다.
  // (기존에는 전역 키만 선점해 사용자별 한도가 실제 소모량의 절반까지만 반영됐다)
  if (quality && !quality.pass) {
    const again = await reserve(
      store,
      [
        { key: scopedQuotaKey('variant', sid, now), limit: VARIANT_LIMIT_PER_SESSION, code: 'RATE_LIMIT_VARIANT' },
        { key: imageQuotaKey(now), limit: imageLimit, code: 'RATE_LIMIT_TOTAL' },
      ],
      now,
      { trackPending: true },
    );
    if (again.ok) {
      const retry = await generateImage(body.images, buildBriefPrompt(merged)).catch(() => null);
      const retryJudgement = retry?.image ? await judgeImage(retry.image, merged) : null;
      const retryQuality = retryJudgement ? verdictDetail(retryJudgement, merged) : null;
      if (retry?.image && retryQuality && (retryQuality.pass || retryQuality.score > quality.score)) {
        image = retry.image;
        quality = retryQuality;
      }
      // 재시도 이미지가 실제로 생성됐으면 차감 유지, 아니면 환불
      if (retry?.image) {
        await again.commit();
      } else {
        await again.release();
      }
    }
  }

  // 성공 확정 — pending 마커를 지우고 카운터는 유지한다
  await held.commit();
  return NextResponse.json({
    tipSet: { image: image.data, mimeType: image.mimeType },
    quality,
  });
}
