import type { NailShape, NailLength } from './types';

/**
 * 사람 네일 아티스트의 실제 작업물처럼 보이게 하는 공통 제약.
 * "AI 그림 티"(플라스틱 피부, 불가능한 파츠, 과채도)를 명시적으로 금지한다.
 */
const HUMAN_ARTIST_LINES = `
- Realism is the top priority: the result must be indistinguishable from a photo of real gel nails done by a skilled human nail artist and shot in a Korean nail salon.
- Every element must be physically buildable by hand with gel, powder, film, and attachable parts. Parts sit ON the nail surface with visible gel encapsulation; nothing floats, morphs, or defies gravity.
- Keep believable hand-made character: micro-variations between nails, natural gel thickness and edge highlights — not computer-perfect symmetry.
- Avoid the AI look entirely: no plastic waxy skin, no oversaturated colors, no extra or warped fingers, no melted nail edges.
- Design taste: contemporary Korean salon trend — clean, editorial, wearable. Novelty comes from color, texture, and light play drawn from the inspiration photos, not from stock motifs.
- Banned clichés — never include: 3D food charms (donut, candy, cake, fruit), ribbon bows, dangling rings or jewelry charms, rainbow sprinkles, cartoon characters, oversized 3D parts taller than the nail's curve. If an inspiration photo contains one, reinterpret its colors and textures instead of copying the motif. Any decoration stays low-profile and refined (micro pearls, fine foil lines, thin hand-painted strokes).`;

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
    ? 'One attached reference image is a flat-lay SET of finished nail tip designs. The five nails on the hand MUST replicate five designs chosen from that set exactly — same colors, textures, gel layers, and patterns. Do not invent new designs; copy them faithfully onto the fingernails.'
    : imageCount > 1
      ? `Synthesize the colors, textures, and mood of ALL ${imageCount} attached inspiration photos into one cohesive design. Each photo's mood must be recognizable in the result.`
      : 'Draw the colors, textures, and mood from the attached inspiration photo.';

  const trendLine = trendKeywords.length > 0 ? `\n- Current K-nail trends to reflect: ${trendKeywords.join(', ')}.` : '';

  return `You are a top Korean nail artist creating this month's signature nail art.
Create ONE photorealistic photo of a finished nail design.
- ${sourceLine}
- Nail shape: ${shape}. Nail length: ${length}. This shape and length are the client's order — they OVERRIDE whatever shape or length appears in the inspiration photos. Take only colors, textures, and mood from the photos.${trendLine}
- Style: glazed glossy finish, chrome/magnetic shimmer, translucent gel layers, dreamy low-saturation K-nail palette. Never flat garish colors.${HUMAN_ARTIST_LINES}
- Composition: close-up of exactly ONE relaxed real hand (a single hand, five fingers — a second hand must not appear anywhere in the frame, not even partially) with fingers gently extended toward the camera, like a typical Instagram manicure after-shot. Each of the five fingernails grows naturally out of its own fingertip's nail bed, surrounded by cuticle and skin — nails are part of the fingers, never objects resting ON the skin. No detached nails, no nails on knuckles or the back of the hand, no cropped stray nails at the frame edge. Soft salon window light, natural skin texture with pores and fine knuckle creases. The nails are the hero of the shot.
- Avoid entirely: real eyes, eyeballs, iris or pupil shapes, faces, or any eye-like motif. Keep it abstract nail art only.
After the image, also output ONE line of plain JSON (no code fences): {"keywords": ["korean mood keyword", "korean mood keyword"], "colors": ["#RRGGBB", "#RRGGBB", "#RRGGBB"]} — 2-3 short Korean mood keywords and the 3 dominant colors.`;
}
