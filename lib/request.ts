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
 * 쿼터를 셀 "주체".
 *
 * 로그인했으면 계정, 아니면 IP. 접두사(`u:` / `ip:`)를 붙여 두 키 공간이 절대 섞이지
 * 않게 한다 — 없으면 어떤 구글 sub 값이 어떤 IP 문자열과 같아질 수 있고, 그 순간
 * 남의 쿼터를 나눠 쓰게 된다.
 *
 * 라우트는 이 함수만 부르므로, 계정 기준으로 바꿀 때 4개 라우트가 아니라 여기 한 곳만 고친다.
 */
export async function quotaSubject(req: Request): Promise<string> {
  const accountId = await currentAccountId();
  return accountId ? `u:${accountId}` : `ip:${clientIp(req)}`;
}

/** 로그인한 계정의 이메일. 표시용이므로 실패 시 null */
export async function currentAccountEmail(): Promise<string | null> {
  try {
    const { auth } = await import('@/auth');
    const session = await auth();
    return session?.user?.email || null;
  } catch {
    return null;
  }
}

/**
 * 동적 import 캐시.
 *
 * import()는 한 번 로드되면 캐시되지만, "처음 로드 중"인 상태의 동시 호출은
 * 환경에 따라 모듈을 중복 평가할 수 있다. 테스트 러너의 mock 레지스트리 같은
 * 경우 중복 평가된 쪽이 mock을 우회한다. promise를 한 번만 만들어 공유하면
 * 경합 자체가 사라진다. 실패하면 캐시를 비워 다음 호출이 다시 시도하게 한다.
 */
let authModule: Promise<typeof import('@/auth')> | null = null;
let paymentsModule: Promise<typeof import('./payments')> | null = null;

function loadAuthModule(): Promise<typeof import('@/auth')> {
  if (!authModule) {
    authModule = import('@/auth').catch((err: unknown) => {
      authModule = null;
      throw err;
    });
  }
  return authModule;
}

function loadPaymentsModule(): Promise<typeof import('./payments')> {
  if (!paymentsModule) {
    paymentsModule = import('./payments').catch((err: unknown) => {
      paymentsModule = null;
      throw err;
    });
  }
  return paymentsModule;
}

/**
 * 로그인한 계정의 구글 sub. 비로그인이거나 인증 설정이 없으면 null.
 *
 * auth()는 환경변수(AUTH_SECRET·구글 클라이언트)가 없으면 던질 수 있는데, 그때 생성
 * 라우트 전체가 500이 되면 안 된다 — 로그인은 편의 기능이고 생성은 핵심 기능이다.
 * 실패하면 비로그인으로 간주하고 IP 기준으로 떨어진다.
 */
async function currentAccountId(): Promise<string | null> {
  try {
    // 동적 import — 인증을 쓰지 않는 코드 경로(그리고 테스트 환경)가 next-auth를
    // 모듈 그래프에 끌어들이지 않게 한다
    const { auth } = await loadAuthModule();
    const session = await auth();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

/**
 * 결제 게이트 — analyze 전용. 횟수권 1회를 선점한다.
 *
 * 호출 1건이 곧 실비이므로 남은 횟수가 있는 계정만 세션을 연다. 성공하면
 * refund()를 돌려준다 — 생성이 실패하면 호출해 "실패는 미차감"을 지킨다.
 * variant·hero는 이 세션이 발급한 토큰(variantToken)으로만 열리므로 다시 차감하지 않는다.
 */
export async function paymentGate(): Promise<
  | { ok: false; status: number; error: 'LOGIN_REQUIRED' | 'PAYMENT_REQUIRED' }
  | { ok: true; creditsLeft: number; refund: () => Promise<void> }
> {
  const sub = await currentAccountId();
  if (!sub) return { ok: false, status: 401, error: 'LOGIN_REQUIRED' };
  // 정적 import를 피한다 — @neondatabase/serverless를 클라이언트 번들에
  // 끌어들이지 않기 위해 기존 auth()와 같은 동적 import 패턴을 쓴다
  const { takeCredit, refundCredit } = await loadPaymentsModule();
  const left = await takeCredit(sub);
  if (left === null) return { ok: false, status: 402, error: 'PAYMENT_REQUIRED' };
  return { ok: true, creditsLeft: left, refund: () => refundCredit(sub) };
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
export function dailyLimits(): {
  userLimit: number;
  totalLimit: number;
  imageLimit: number;
  ipLimit: number;
} {
  const userLimit = envLimit('DAILY_USER_LIMIT', 3);
  return {
    userLimit,
    totalLimit: envLimit('DAILY_TOTAL_LIMIT', 200),
    imageLimit: envLimit('DAILY_IMAGE_LIMIT', 200),
    /**
     * IP당 세션 상한. 계정 한도보다 넉넉하게 두는 이유는 공유 IP(카페·회사·모바일 CGNAT)
     * 때문이다 — 너무 빡빡하면 무고한 사용자가 서로의 한도를 잡아먹는다.
     * 기본값은 계정 한도의 2배.
     */
    ipLimit: envLimit('DAILY_IP_LIMIT', userLimit * 2),
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
