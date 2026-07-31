/**
 * 현재 유행하는 네일 트렌드 키워드. 시즌마다 이 파일 또는
 * TREND_KEYWORDS 환경 변수(쉼표 구분)를 갱신한다. (스펙: 트렌드 하드코딩 금지)
 */
export const DEFAULT_TREND_KEYWORDS = [
  // "glazed donut"은 이미지 모델이 실제 도넛 파츠로 오해하므로 질감으로만 서술
  'glass-skin glazed glossy finish (no food motifs)',
  // "cat-eye"는 이미지 모델이 실제 눈알로 오해하므로 효과만 서술
  'chrome magnetic velvet shimmer (single sweeping light streak)',
  'sheer syrup jelly gradient',
  'blurred aura blush gradient',
  'thin micro french line in a contrasting tone',
];

export function getTrendKeywords(): string[] {
  const env = process.env.TREND_KEYWORDS;
  if (env && env.trim()) {
    return env.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return DEFAULT_TREND_KEYWORDS;
}
