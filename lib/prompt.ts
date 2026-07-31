import type { NailAnalysis, NailShape, NailLength } from './types';

/**
 * 1단계 분석 결과 → 생성 프롬프트에 넣을 디자인 브리프.
 * 참조 사진의 특징을 텍스트로 고정해, 생성 모델이 사진의 어떤 요소를
 * 반영해야 하는지 명시적으로 통제한다 (분석 실패 시 빈 문자열 = 기존 동작).
 */
export function buildAnalysisBrief(analysis: NailAnalysis | null): string {
  if (!analysis) return '';
  const partsLine = analysis.parts.length > 0 ? ` Parts: ${analysis.parts.join(', ')}.` : '';
  return `\n- Design brief extracted by a salon owner from the inspiration photos — follow it precisely: base ${analysis.baseStyle}; techniques ${analysis.techniques.join(', ')}; finish ${analysis.finish}; dominant colors ${analysis.colors.join(', ')}.${partsLine}`;
}

/**
 * 사람 네일 아티스트의 실제 작업물처럼 보이게 하는 공통 제약.
 * "AI 그림 티"(플라스틱 피부, 불가능한 파츠, 과채도)를 명시적으로 금지한다.
 */
const HUMAN_ARTIST_LINES = `
- Realism is the top priority: the result must be indistinguishable from a photo of real gel nails done by a skilled human nail artist and shot in a Korean nail salon.
- Every element must be physically buildable by hand with gel, powder, film, and attachable parts. Parts sit ON the nail surface with visible gel encapsulation; nothing floats, morphs, or defies gravity.
- Keep believable hand-made character: micro-variations between nails, natural gel thickness and edge highlights — not computer-perfect symmetry.
- Avoid the AI look entirely: no plastic waxy skin, no oversaturated colors, no extra or warped fingers, no melted nail edges.`;

/**
 * Gemini 이미지 생성 지시문. 스타일 앵커는 스펙의 "네일 미감 기준"
 * (ref/ 11장: 글레이즈드 광택, 크롬, 3D 파츠, 저채도 몽환 톤)을 따른다.
 */
export function buildPrompt(
  shape: NailShape,
  length: NailLength,
  trendKeywords: string[],
  imageCount: number,
  hasTipReference = false,
  analysis: NailAnalysis | null = null,
): string {
  const sourceLine = hasTipReference
    ? 'One attached reference image is a flat-lay SET of finished nail tip designs. The nails on the hand MUST replicate the designs from that set exactly — same colors, textures, gel layers, 3D parts, and patterns. Do not invent new designs; copy them faithfully onto the fingernails.'
    : imageCount > 1
      ? `Synthesize the colors, textures, and mood of ALL ${imageCount} attached inspiration photos into one cohesive design. Each photo's mood must be recognizable in the result.`
      : 'Draw the colors, textures, and mood from the attached inspiration photo.';

  const trendLine = trendKeywords.length > 0 ? `\n- Current K-nail trends to reflect: ${trendKeywords.join(', ')}.` : '';

  return `You are a top Korean nail artist creating this month's signature nail art.
Create ONE photorealistic photo of a finished nail design.
- ${sourceLine}${buildAnalysisBrief(analysis)}
- Nail shape: ${shape}. Nail length: ${length}.${trendLine}
- Style: glazed glossy finish, chrome/magnetic shimmer, translucent gel layers, tasteful 3D parts inspired by the photos, dreamy low-saturation K-nail palette. Never flat garish colors.${HUMAN_ARTIST_LINES}
- Composition: natural close-up of a real hand wearing the finished nails, soft salon window light, natural skin texture with pores and fine knuckle creases. The nails are the hero of the shot.
- Avoid entirely: real eyes, eyeballs, iris or pupil shapes, faces, or any eye-like motif. Keep it abstract nail art only.
After the image, also output ONE line of plain JSON (no code fences): {"keywords": ["korean mood keyword", "korean mood keyword"], "colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB"]} — 2-3 short Korean mood keywords and the 3 dominant colors.`;
}

/**
 * 네일 팁 세트(플랫레이) 지시문. 흰 배경에 개별 팁 10개(2행 5열)를 각각
 * 다른 디자인으로 — 네일샵 샘플/프레스온 세트처럼 보이게 한다.
 */
export function buildTipSetPrompt(
  shape: NailShape,
  length: NailLength,
  trendKeywords: string[],
  imageCount: number,
  analysis: NailAnalysis | null = null,
): string {
  const sourceLine =
    imageCount > 1
      ? `all ${imageCount} attached inspiration photos`
      : 'the attached inspiration photo';

  const trendLine = trendKeywords.length > 0 ? `\n- Trends to reflect across the set: ${trendKeywords.join(', ')}.` : '';

  return `You are a top Korean nail artist presenting this month's design set.
Create ONE photorealistic top-down flat-lay photo of a press-on nail SET: exactly 10 individual nail tips arranged neatly in 2 rows of 5 on a clean plain white background, evenly spaced, soft even studio lighting with a subtle shadow.
- Each of the 10 tips shows a DIFFERENT finished design, but the whole set shares one cohesive theme drawn from ${sourceLine}.${buildAnalysisBrief(analysis)}
- Nail tip shape: ${shape}. Length: ${length}.${trendLine}
- Style: glazed glossy finish, chrome/magnetic shimmer, translucent gel layers, tasteful 3D parts (ribbon, pearl, flower), dreamy low-saturation K-nail palette. Never flat garish colors.${HUMAN_ARTIST_LINES}
- The 10 tips are the only subject: no hands, no fingers, no text, no packaging — just the tips on white.
- Avoid entirely: real eyes, eyeballs, iris or pupil shapes, faces, or any eye-like motif. Keep it abstract nail art only.`;
}
