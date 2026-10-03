/**
 * 변주 스타일 3종 — 3장이 "서로 다른 시술 스타일"로 나오게 하는 축.
 * 영감 사진은 모티프·색·무드만 정하고, 표현 기법·파츠 밀도는 여기서 정한다
 * (그래픽 영감 사진의 파츠 개수를 따라가면 3D가 거의 안 붙었다 — 2026-09-22 run2).
 *
 * 클라이언트는 styleId만 보내고 문장은 서버가 조립한다 — 긴 자유 문장을 클라이언트에서
 * 받으면 생성 프롬프트에 임의 텍스트를 꽂을 수 있게 된다.
 * "charm"·"anchor" 금지 (PARTS_ANALYSIS 5-1절).
 */
export const STYLE_IDS = ['glass-jelly', 'y2k-handpaint', 'kitsch-3d'] as const;
export type StyleId = (typeof STYLE_IDS)[number];

export interface StyleProfile {
  id: StyleId;
  /** 카드 라벨 (한국어) */
  title: string;
  /** 카드 설명 한 줄 (한국어) */
  note: string;
  baseLine: string;
  structureLine: string;
  textureLine: string;
  /** 파츠 밀도는 스타일이 소유 — 명시 개수 + 나머지 배제 문장 (검수기 expectedMetalTips가 읽는다) */
  partsLine: string;
  /** 생성 프롬프트에 붙는 스타일 규칙 */
  styleBlock: string;
}

export const STYLES: Record<StyleId, StyleProfile> = {
  'glass-jelly': {
    id: 'glass-jelly',
    title: '글래스 젤리',
    note: '투명한 젤리 위에 입체 조각을 올렸어요',
    baseLine:
      'Base: translucent jelly gel with a soft pastel gradient melting along each tip, glass-gloss finish.',
    structureLine:
      'Full-length design: color and sculpted elements run the whole tip, with a sheer clear free edge on the calmer tips.',
    textureLine: 'Finish: aurora pearl-iridescent chrome sheen on three tips, glass-gloss jelly on the rest.',
    partsLine:
      'Exactly four tips carry one sculpted 3D centerpiece each, built from clear or tinted builder gel (a veined flower, a seashell, a starfish or a twisted spiral horn, taken from the reference motifs). Exactly three other tips carry a small cluster of two to four pearls and tiny flat-back crystal rhinestones. The remaining tips carry fine white line work or an aurora chrome finish, each different.',
    styleBlock: `STYLE — glass jelly 3D:
- Every sculpted element is glassy and tone-on-tone with the base, catching light like frosted glass or sea glass.
- Fine white line work and tiny dots stay delicate and sit behind the 3D elements.
- The set feels like an underwater fairy: soft, luminous, airy.`,
  },
  'y2k-handpaint': {
    id: 'y2k-handpaint',
    title: 'Y2K 핸드페인팅',
    note: '반짝이 누드 위에 붓으로 그린 2000년대 스타일이에요',
    baseLine:
      'Base: sheer pink nude with fine holographic glitter suspended in clear gel near the cuticle.',
    structureLine:
      'Long deep-French structure: the glitter nude covers the cuticle half, and the free half of every tip is an opaque painted zone (milky white on most tips, one tip in pastel green, one in pale pink).',
    textureLine: 'Finish: high-gloss top coat on every tip.',
    partsLine:
      'Exactly three tips carry one small flat silver metal stud shaped as a star at the french boundary. Exactly four other tips carry two or three tiny flat-back crystal rhinestones along the french boundary. Every tip, with or without parts, carries its own hand-painted pattern.',
    styleBlock: `STYLE — Y2K hand-painted:
- The painted zones carry fine hand-painted line art: curling vine swirls with tiny leaves, candy stripes, polka dots, small five-petal flowers, taken from the reference motifs and palette.
- Each tip carries a different painted pattern, like a hand-drawn 2000s nail set.
- Lines are thin and confident, with small hand-made irregularities.`,
  },
  'kitsch-3d': {
    id: 'kitsch-3d',
    title: '키치 3D 콜라주',
    note: '팁마다 다른 입체 장식을 가득 모았어요',
    baseLine:
      'Base: pastel mix across the set — milky white, soft pistachio green, blush pink and cocoa beige — each tip in one or two of these colors.',
    structureLine:
      'Mixed structure: each tip uses a different layout (diagonal french, stripe band, split halves, full color), and the set reads as a collage.',
    textureLine: 'Finish: glossy gel with raised painted relief lines.',
    partsLine:
      'Exactly five tips carry one 3D element each: a sculpted gel flower with pink petals, small pastel sewing buttons with two visible thread holes, or a raised gel motif taken from the reference. Exactly four other tips carry scattered small pearls and tiny flat-back crystal rhinestones. The remaining tip carries painted piano-key stripes.',
    styleBlock: `STYLE — kitsch 3D collage:
- Maximal and playful: every tip is different, mixing painted swirls, piano-key stripe bands, polka dots and small 3D pieces.
- Motifs from the reference become raised gel reliefs or small sculpted pieces, all flush on the nail surface.
- The palette stays soft pastel so the busy set still feels sweet and cohesive.`,
  },
};
