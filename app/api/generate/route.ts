import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getQuota, recordGeneration } from '@/lib/quota';
import { buildPrompt, buildTipSetPrompt } from '@/lib/prompt';
import { getTrendKeywords } from '@/config/trends';
import { generateImage } from '@/lib/provider';
import { analyzeReferences, moodFromAnalysis } from '@/lib/analyze';
import { analyzeToBrief } from '@/lib/brief';
import { generateJudged } from '@/lib/judge';
import type { ImageOutcome, ImagePayload } from '@/lib/types';
import type { GenerateErrorCode, GenerateRequest, NailLength, NailShape } from '@/lib/types';

export const maxDuration = 60; // Gemini 생성 10~20초 + 여유

const SHAPES: NailShape[] = ['almond', 'round', 'square', 'stiletto'];
const LENGTHS: NailLength[] = ['short', 'medium', 'long'];
const MAX_IMAGE_BASE64_CHARS = 2_000_000; // 리사이즈된 JPEG 기준 넉넉한 상한 (~1.5MB)

function clientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();
  const header = req.headers.get('x-forwarded-for');
  return header?.split(',')[0]?.trim() || 'unknown';
}

function limits(): { userLimit: number; totalLimit: number } {
  return {
    userLimit: Number(process.env.DAILY_USER_LIMIT ?? 3),
    totalLimit: Number(process.env.DAILY_TOTAL_LIMIT ?? 200),
  };
}

/** Promise.allSettled 결과에서 성공 결과만 꺼냄 (실패는 null) */
function settledOutcome(r: PromiseSettledResult<ImageOutcome>): ImageOutcome | null {
  return r.status === 'fulfilled' ? r.value : null;
}

function errorResponse(error: GenerateErrorCode, status: number): NextResponse {
  return NextResponse.json({ error }, { status });
}

function validateBody(body: unknown): GenerateRequest | null {
  if (typeof body !== 'object' || body === null) return null;
  const { images, shape, length } = body as Record<string, unknown>;
  if (!SHAPES.includes(shape as NailShape)) return null;
  if (!LENGTHS.includes(length as NailLength)) return null;
  if (!Array.isArray(images) || images.length < 1 || images.length > 3) return null;
  for (const img of images) {
    if (typeof img !== 'object' || img === null) return null;
    const { data, mimeType } = img as Record<string, unknown>;
    if (typeof data !== 'string' || data.length === 0 || data.length > MAX_IMAGE_BASE64_CHARS) return null;
    if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) return null;
  }
  return body as GenerateRequest;
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
  const { userLimit, totalLimit } = limits();

  const quota = await getQuota(store, ip, now, userLimit, totalLimit);
  if (quota.userRemaining <= 0) return errorResponse('RATE_LIMIT_USER', 429);
  if (quota.totalExhausted) return errorResponse('RATE_LIMIT_TOTAL', 429);

  const trends = getTrendKeywords();

  // 0단계(분석 v2): 참조 사진 → 구조 문법 브리프 (검증: ref/results/pilot-auto-interpret, 충실도 ~90%).
  // 쉐입·길이는 손님 주문이 사진을 이긴다 — 브리프의 관찰값을 주문값으로 덮어씀.
  const rawBrief = await analyzeToBrief(body.images);
  const brief = rawBrief ? { ...rawBrief, shape: body.shape, length: body.length } : null;

  // 브리프 실패 시에만 구 분석 경로 폴백 (기존 동작 보존)
  const analysis = brief ? null : await analyzeReferences(body.images);

  // 1단계: 팁 세트 생성 (디자인의 기준이 됨)
  //  - 신규 경로: 2장 병렬 생성 + vision 검수 → 통과작(없으면 최고점) 선택.
  //    라우트 응답 시간(60s) 안에 들어야 하므로 추가 생성(extra)은 두지 않는다 —
  //    2장 전멸 확률 ~1%, 그 경우에도 최고점 컷이 반환되므로 빈손은 없음.
  //  - 폴백 경로: 기존 단일 생성.
  let tipOutcome: ImageOutcome | null = null;
  let tipQuality: { pass: boolean; score: number } | null = null;
  if (brief) {
    const { best } = await generateJudged(body.images, brief, { batch: 2, extra: 0 });
    if (best) {
      tipOutcome = { image: best.image, mood: null, safetyBlocked: false };
      tipQuality = { pass: best.pass, score: best.score };
    }
  }
  if (!tipOutcome) {
    const tipPrompt = buildTipSetPrompt(body.shape, body.length, trends, body.images.length, analysis);
    tipOutcome = settledOutcome(
      await Promise.allSettled([generateImage(body.images, tipPrompt)]).then((r) => r[0]),
    );
  }

  // 2단계: 팁 세트가 있으면 그 이미지를 참조로 넘겨, 손톱이 팁과 같은 디자인이 되게 함.
  //        팁 세트 실패 시엔 영감 사진만으로 히어로 생성(디자인 일치 보장 없음).
  const heroRefs: ImagePayload[] = tipOutcome?.image
    ? [...body.images, { data: tipOutcome.image.data, mimeType: tipOutcome.image.mimeType }]
    : body.images;
  const heroPrompt = buildPrompt(body.shape, body.length, trends, body.images.length, !!tipOutcome?.image, analysis);
  const heroOutcome = settledOutcome(
    await Promise.allSettled([generateImage(heroRefs, heroPrompt)]).then((r) => r[0]),
  );

  // 히어로는 필수. 없으면 안전 차단이면 REJECTED, 그 외 생성 실패.
  if (!heroOutcome?.image) {
    const blocked = heroOutcome?.safetyBlocked === true || tipOutcome?.safetyBlocked === true;
    return errorResponse(blocked ? 'REJECTED' : 'GENERATION_FAILED', blocked ? 422 : 502);
  }

  // 성공 후에만 차감 (실패 미차감 규칙). 손+팁 합쳐 1회로 계산.
  // getQuota→recordGeneration 사이 동시성으로 소폭 초과 가능하나 전체 총량 한도가 상한을 보장 — 의도된 트레이드오프.
  await recordGeneration(store, ip, now);

  return NextResponse.json({
    hero: { image: heroOutcome.image.data, mimeType: heroOutcome.image.mimeType },
    tipSet: tipOutcome?.image ? { image: tipOutcome.image.data, mimeType: tipOutcome.image.mimeType } : null,
    mood:
      heroOutcome.mood ??
      tipOutcome?.mood ??
      (brief ? { keywords: brief.keywords, colors: brief.colors } : moodFromAnalysis(analysis)),
    // 검수 결과 (신규 경로에서만 존재) — 클라이언트가 "검수 통과" 배지 등에 활용 가능한 추가 필드
    tipSetQuality: tipQuality,
    remaining: quota.userRemaining - 1,
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  const { userLimit, totalLimit } = limits();
  const quota = await getQuota(getRedis(), clientIp(req), new Date(), userLimit, totalLimit);
  return NextResponse.json({ remaining: quota.userRemaining });
}
