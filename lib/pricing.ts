/**
 * 가격·횟수 상수 — 서버(lib/payments)와 화면이 함께 쓴다.
 * lib/payments는 DB 드라이버를 끌고 오므로 클라이언트 컴포넌트는 여기서 가져간다.
 *
 * 결제창(/api/checkout)이 이 값으로 직접 과금하므로 표시가와 과금액이 갈라지지 않는다.
 */
export const PRICE_REGULAR_KRW = 9900;
/** 결제 1건에 지급하는 생성 횟수. 1회 = analyze 1번 + 시안·착용샷 세션 한도 */
export const PACK_CREDITS = 10;
