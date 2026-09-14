import type { ImagePayload, NailLength, NailShape } from './types';

/**
 * API 라우트 공용 요청 헬퍼 — analyze/variant/hero 신규 3라우트에서 사용.
 * (기존 app/api/generate/route.ts는 레거시 유지 원칙에 따라 자체 구현을 그대로 둔다.)
 */

export const SHAPES: NailShape[] = ['almond', 'round', 'square', 'stiletto'];
export const LENGTHS: NailLength[] = ['short', 'medium', 'long'];
export const MAX_IMAGE_BASE64_CHARS = 2_000_000; // 리사이즈된 JPEG 기준 넉넉한 상한 (~1.5MB)

/**
 * IPv6는 한 사용자가 /64 블록(주소 1,800경 개)을 통째로 받는다. 주소를 그대로 키로 쓰면
 * 요청마다 새 주소 = 새 쿼터가 되어 한도가 사실상 없는 것과 같다. /64로 묶어 센다.
 */
function normalizeIp(ip: string): string {
  if (!ip.includes(':')) return ip; // IPv4는 그대로
  const groups = ip.split('%')[0].split(':'); // zone id(%eth0) 제거
  return groups.slice(0, 4).join(':') + '::/64';
}

/**
 * 프록시 헤더에서 클라이언트 IP 추출 (x-real-ip 우선, 없으면 x-forwarded-for 첫 항목).
 *
 * 전제: Vercel(및 동급 프록시) 뒤에서만 안전하다 — 플랫폼이 이 헤더를 덮어쓰므로 위조가
 * 막힌다. 프록시 없는 환경으로 옮기면 헤더 한 줄로 쿼터가 무력화되니 그때는 신뢰 경계를
 * 다시 세워야 한다.
 */
export function clientIp(req: Request): string {
  const realIp = req.headers.get('x-real-ip');
  if (realIp && realIp.trim()) return normalizeIp(realIp.trim());
  const header = req.headers.get('x-forwarded-for');
  const first = header?.split(',')[0]?.trim();
  return first ? normalizeIp(first) : 'unknown';
}

/**
 * 환경변수 숫자 파싱 — 오타·빈값이면 기본값으로 떨어진다.
 *
 * Number("오타")는 NaN이고 NaN 비교는 전부 false라, 그냥 Number()를 쓰면 환경변수 오타
 * 하나로 **모든 한도 검사가 조용히 통과**한다(에러도 안 난다). 실제로 배포 첫날 한도가
 * 테스트값 그대로 올라가 상한이 사라진 적이 있어, 파싱 단계에서 막는다.
 */
function envLimit(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

/**
 * 일일 한도.
 *
 * imageLimit이 실질적인 하루 지출 상한이다 — 비용은 세션이 아니라 생성한 이미지 장수에
 * 비례하기 때문(세션 1건 = 변주 5장 + 착용샷). 장당 원가를 55~70원으로 보면
 * 기본값 200장 ≈ 하루 최대 1.1만~1.4만 원. 트래픽을 늘릴 때 이 숫자부터 올린다.
 */
export function dailyLimits(): { userLimit: number; totalLimit: number; imageLimit: number } {
  return {
    userLimit: envLimit('DAILY_USER_LIMIT', 3),
    totalLimit: envLimit('DAILY_TOTAL_LIMIT', 200),
    imageLimit: envLimit('DAILY_IMAGE_LIMIT', 200),
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
