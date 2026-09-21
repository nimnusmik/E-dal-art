/**
 * 목 모드 단일 판정.
 *
 * 프로바이더별 플래그를 각자 묻지 않는다 — 한쪽만 켠 상태에서 다른 쪽이
 * 조용히 실제 API로 새는 구멍을 막기 위함이다. (IMAGE_PROVIDER=seedream인데
 * GEMINI_MOCK=1만 켜면 Seedream으로 실호출이 나가던 사고가 있었다.)
 *
 * IMAGE_MOCK이 정식 이름이고, 나머지 둘은 기존 스크립트 호환용으로 계속 인정한다.
 */
export function isMock(): boolean {
  return (
    process.env.IMAGE_MOCK === '1' ||
    process.env.GEMINI_MOCK === '1' ||
    process.env.SEEDREAM_MOCK === '1'
  );
}
