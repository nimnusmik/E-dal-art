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
): string {
  const sourceLine =
    imageCount > 1
      ? `Synthesize the colors, textures, and mood of ALL ${imageCount} attached inspiration photos into one cohesive design. Each photo's mood must be recognizable in the result.`
      : 'Draw the colors, textures, and mood from the attached inspiration photo.';

  const trendLine = trendKeywords.length > 0 ? `\n- Current K-nail trends to reflect: ${trendKeywords.join(', ')}.` : '';

  return `You are a top Korean nail artist creating this month's signature nail art.
Create ONE photorealistic photo of a finished nail design.
- ${sourceLine}
- Nail shape: ${shape}. Nail length: ${length}.${trendLine}
- Style: glazed glossy finish, chrome/magnetic shimmer, translucent gel layers, tasteful 3D parts inspired by the photos, dreamy low-saturation K-nail palette. Never flat garish colors.
- Composition: natural close-up of a real hand wearing the finished nails. The nails are the hero of the shot.
After the image, also output ONE line of plain JSON (no code fences): {"keywords": ["korean mood keyword", "korean mood keyword"], "colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB"]} — 2-3 short Korean mood keywords and the 3 dominant colors.`;
}
