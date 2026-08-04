import type { ImagePayload, NailLength, NailShape } from './types';

/**
 * API 라우트 공용 요청 헬퍼 — analyze/variant/hero 신규 3라우트에서 사용.
 * (기존 app/api/generate/route.ts는 레거시 유지 원칙에 따라 자체 구현을 그대로 둔다.)
 */

export const SHAPES: NailShape[] = ['almond', 'round', 'square', 'stiletto'];
export const LENGTHS: NailLength[] = ['short', 'medium', 'long'];
export const MAX_IMAGE_BASE64_CHARS = 2_000_000; // 리사이즈된 JPEG 기준 넉넉한 상한 (~1.5MB)

/** 프록시 헤더에서 클라이언트 IP 추출 (x-real-ip 우선, 없으면 x-forwarded-for 첫 항목) */
export function clientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return realIp.trim();
  const header = req.headers.get('x-forwarded-for');
  return header?.split(',')[0]?.trim() || 'unknown';
}

/** 일일 한도 (환경변수, 기본값은 기존 generate 라우트와 동일) */
export function dailyLimits(): { userLimit: number; totalLimit: number } {
  return {
    userLimit: Number(process.env.DAILY_USER_LIMIT ?? 3),
    totalLimit: Number(process.env.DAILY_TOTAL_LIMIT ?? 200),
  };
}

/** 이미지 배열 검증 (1~3장, base64 크기·MIME 제한) — 위반 시 null */
export function parseImages(value: unknown): ImagePayload[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 3) return null;
  for (const img of value) {
    if (typeof img !== 'object' || img === null) return null;
    const { data, mimeType } = img as Record<string, unknown>;
    if (typeof data !== 'string' || data.length === 0 || data.length > MAX_IMAGE_BASE64_CHARS) return null;
    if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) return null;
  }
  return value as ImagePayload[];
}

export function isNailShape(value: unknown): value is NailShape {
  return SHAPES.includes(value as NailShape);
}

export function isNailLength(value: unknown): value is NailLength {
  return LENGTHS.includes(value as NailLength);
}
