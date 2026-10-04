/**
 * 가격·횟수 상수 — 서버(lib/payments)와 화면이 함께 쓴다.
 * lib/payments는 DB 드라이버를 끌고 오므로 클라이언트 컴포넌트는 여기서 가져간다.
 *
 * 실제 과금은 Stripe Price가 하지만, 표시와 과금이 갈라지면 안 되므로
 * 바꾸면 STRIPE_PRICE_ID·쿠폰도 함께 바꾼다.
 */
export const PRICE_REGULAR_KRW = 9900;
/** 얼리버드 실결제액 = 정가 − 쿠폰(5000원) */
export const PRICE_EARLY_KRW = 4900;
/** 결제 1건에 지급하는 생성 횟수. 1회 = analyze 1번 + 시안·착용샷 세션 한도 */
export const PACK_CREDITS = 10;
