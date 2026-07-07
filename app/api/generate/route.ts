import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { getQuota, recordGeneration } from '@/lib/quota';
import { buildPrompt } from '@/lib/prompt';
import { getTrendKeywords } from '@/config/trends';
import { callGemini } from '@/lib/gemini';
import type { GenerateErrorCode, GenerateRequest, NailLength, NailShape } from '@/lib/types';

export const maxDuration = 60; // Gemini 생성 10~20초 + 여유

const SHAPES: NailShape[] = ['almond', 'round', 'square', 'stiletto'];
const LENGTHS: NailLength[] = ['short', 'medium', 'long'];
const MAX_IMAGE_BASE64_CHARS = 2_000_000; // 리사이즈된 JPEG 기준 넉넉한 상한 (~1.5MB)

function clientIp(req: Request): string {
  const header = req.headers.get('x-forwarded-for');
  return header?.split(',')[0]?.trim() || 'unknown';
}

function limits(): { userLimit: number; totalLimit: number } {
  return {
    userLimit: Number(process.env.DAILY_USER_LIMIT ?? 3),
    totalLimit: Number(process.env.DAILY_TOTAL_LIMIT ?? 200),
  };
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

  const prompt = buildPrompt(body.shape, body.length, getTrendKeywords(), body.images.length);

  let outcome;
  try {
    outcome = await callGemini(body.images, prompt);
  } catch {
    return errorResponse('GENERATION_FAILED', 502);
  }
  if (outcome.safetyBlocked) return errorResponse('REJECTED', 422);
  if (!outcome.image) return errorResponse('GENERATION_FAILED', 502);

  await recordGeneration(store, ip, now); // 성공 시에만 차감

  return NextResponse.json({
    image: outcome.image.data,
    mimeType: outcome.image.mimeType,
    mood: outcome.mood,
    remaining: quota.userRemaining - 1,
  });
}

export async function GET(req: Request): Promise<NextResponse> {
  const { userLimit, totalLimit } = limits();
  const quota = await getQuota(getRedis(), clientIp(req), new Date(), userLimit, totalLimit);
  return NextResponse.json({ remaining: quota.userRemaining });
}
