/**
 * 목 모드 단일 판정.
 *
 * 프로바이더별 플래그를 각자 묻지 않는다 — 한쪽만 켠 상태에서 다른 쪽이
 * 조용히 실제 API로 새는 구멍을 막기 위함이다. (IMAGE_PROVIDER=seedream인데
 * GEMINI_MOCK=1만 켜면 Seedream으로 실호출이 나가던 사고가 있었다.)
 *
 * IMAGE_MOCK이 정식 이름이고, 나머지 둘은 기존 스크립트 호환용으로 계속 인정한다.
 *
 * 운영 안전장치: 디버깅용으로 Vercel에 플래그를 넣고 제거를 잊으면 유료 생성이
 * 조용히 샘플 이미지로 바뀌는 사고가 난다. 운영 환경에서는 플래그와 무관하게
 * 항상 false를 반환한다.
 */
export function isMock(): boolean {
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    return false;
  }
  return (
    process.env.IMAGE_MOCK === '1' ||
    process.env.GEMINI_MOCK === '1' ||
    process.env.SEEDREAM_MOCK === '1'
  );
}
