import type { NailShape, NailLength } from './types';

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
): string {
  const sourceLine = hasTipReference
    ? 'One attached reference image is a flat-lay SET of finished nail tip designs. The nails on the hand MUST replicate the designs from that set exactly — same colors, textures, gel layers, 3D parts, and patterns. Do not invent new designs; copy them faithfully onto the fingernails.'
    : imageCount > 1
      ? `Synthesize the colors, textures, and mood of ALL ${imageCount} attached inspiration photos into one cohesive design. Each photo's mood must be recognizable in the result.`
      : 'Draw the colors, textures, and mood from the attached inspiration photo.';

  const trendLine = trendKeywords.length > 0 ? `\n- Current K-nail trends to reflect: ${trendKeywords.join(', ')}.` : '';

  return `You are a top Korean nail artist creating this month's signature nail art.
Create ONE photorealistic photo of a finished nail design.
- ${sourceLine}
- Nail shape: ${shape}. Nail length: ${length}.${trendLine}
- Style: glazed glossy finish, chrome/magnetic shimmer, translucent gel layers, tasteful 3D parts inspired by the photos, dreamy low-saturation K-nail palette. Never flat garish colors.
- Composition: natural close-up of a real hand wearing the finished nails. The nails are the hero of the shot.
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
): string {
  const sourceLine =
    imageCount > 1
      ? `all ${imageCount} attached inspiration photos`
      : 'the attached inspiration photo';

  const trendLine = trendKeywords.length > 0 ? `\n- Trends to reflect across the set: ${trendKeywords.join(', ')}.` : '';

  return `You are a top Korean nail artist presenting this month's design set.
Create ONE photorealistic top-down flat-lay photo of a press-on nail SET: exactly 10 individual nail tips arranged neatly in 2 rows of 5 on a clean plain white background, evenly spaced, soft even studio lighting with a subtle shadow.
- Each of the 10 tips shows a DIFFERENT finished design, but the whole set shares one cohesive theme drawn from ${sourceLine}.
- Nail tip shape: ${shape}. Length: ${length}.${trendLine}
- Style: glazed glossy finish, chrome/magnetic shimmer, translucent gel layers, tasteful 3D parts (ribbon, pearl, flower), dreamy low-saturation K-nail palette. Never flat garish colors.
- The 10 tips are the only subject: no hands, no fingers, no text, no packaging — just the tips on white.
- Avoid entirely: real eyes, eyeballs, iris or pupil shapes, faces, or any eye-like motif. Keep it abstract nail art only.`;
}
