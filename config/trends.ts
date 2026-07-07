/**
 * 현재 유행하는 네일 트렌드 키워드. 시즌마다 이 파일 또는
 * TREND_KEYWORDS 환경 변수(쉼표 구분)를 갱신한다. (스펙: 트렌드 하드코딩 금지)
 */
export const DEFAULT_TREND_KEYWORDS = [
  'glazed donut glossy finish',
  'chrome magnetic cat-eye shimmer',
  'syrup gradient sheer layers',
  'subtle 3D charm parts (ribbon, pearl, flower)',
];

export function getTrendKeywords(): string[] {
  const env = process.env.TREND_KEYWORDS;
  if (env && env.trim()) {
    return env.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_TREND_KEYWORDS;
}
