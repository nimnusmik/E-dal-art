/**
 * 초대 코드 클라이언트 보관.
 *
 * 서버가 INVITE_CODES를 들고 판정하고(lib/request.ts), 브라우저는 사용자가 입력한 코드를
 * localStorage에 두었다가 생성 요청 헤더에 실어 보낸다. 코드는 비밀이 아니라
 * "공개 트래픽이 실수로 생성 비용을 태우지 않게 하는 문턱"이므로 클라이언트 보관으로 충분하다.
 * (탭을 닫아도 남아야 하므로 sessionStorage가 아니라 localStorage.)
 */
const KEY = 'idala:invite';

export function getInvite(): string {
  if (typeof localStorage === 'undefined') return '';
  try {
    return localStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
}

export function setInvite(code: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, code.trim());
  } catch {
    /* 프라이빗 모드 등 — 이번 세션에서만 못 쓸 뿐이라 삼킨다 */
  }
}

export function clearInvite(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

/** 생성 요청 공통 헤더 — 코드가 없으면 헤더를 붙이지 않는다(게이트가 꺼진 환경 대비) */
export function inviteHeaders(): Record<string, string> {
  const code = getInvite();
  return code ? { 'x-invite-code': code } : {};
}
