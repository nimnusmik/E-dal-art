import type { NailCore } from '@/lib/core';

/**
 * 뉘앙스 코어 — 2026년 1순위 트렌드. 일본·한국 발원.
 * 도쿄 네일 엑스포에서 본 것의 85%가 이것이었다는 증언 (스펙 2-1절).
 * 핵심은 "겹쳐서 생기는 깊이" — 경계선이 없고, 색이 층으로 쌓인다.
 */
export const nuance: NailCore = {
  id: 'nuance',
  nameKo: '뉘앙스',
  taglineKo: '광물을 캐낸 단면',
  noise: 2,

  baseLine:
    'Base of every tip: sheer translucent colour built up in several layers, so looking at the tip feels like looking into a cross-section of polished mineral.',
  structure: 'layered-sheer',
  negativeSpace: [0.2, 0.4],
  designZone: {
    short:
      'Length rule (short tips): the layered colour spreads across the whole tip with no boundary line; keep the number of layers to two or three so the small surface stays readable.',
    medium:
      'Length rule (medium tips): the layered colour spreads across the whole tip with no boundary line; three or four layers of sheer colour build the depth.',
    long:
      'Length rule (long tips): the layered colour runs the full length of the tip with no boundary line; four or more layers, and the swirl can travel from cuticle to free edge.',
  },

  textureGrammar: [
    'Sheer jelly and milky colours are layered over a magnetic cat-eye base, so one soft light streak moves underneath the translucent layers.',
    'Soft swirls are dragged through the wet sheer layers, their edges blurring into one another with no hard line anywhere.',
    'Fine chrome lines trace a few of the swirl boundaries, catching light like a mineral vein.',
  ],
  finishMix:
    'One high-gloss finish over the whole set; the depth comes from the layers underneath rather than from the top coat.',

  partsPhysics:
    'PART PHYSICS: any part is a tiny flat metal bead lying flush ON the surface, sealed under clear gel so it reads as one of the layers rather than an object added on top.',
  partsBudget: { big: 0, studs: [0, 2] },
  allowedMaterials: ['painted', 'chrome', 'metal'],
  motifBudget: 2,

  signature: [
    'Every tip is a different draw from the same mineral: the same colours layered in a different order, so no two tips repeat.',
    'Colour boundaries are always soft — where two colours meet they bleed into each other over a millimetre or more.',
    'One or two tips carry a fine chrome vein tracing the edge of a swirl, and nothing else.',
    'Earth-and-water colours dominate: forest green, warm brown, deep-sea blue, smoky amethyst.',
  ],

  forbidden: [
    'hard-edged geometric motifs',
    'opaque flat colour blocking',
    'a french boundary line',
    'crisp outlines around shapes',
    'glitter particles',
  ],

  variantOps: ['palette-rotate', 'layer-depth', 'swirl-direction', 'density', 'chrome-accent'],
  attachPhoto: false,

  judge: {
    minPartsTips: 0,
    maxPartsTips: 2,
    allowGelVolume: false,
    minNegativeSpace: 0.2,
    requiresGelVolume: false,
    expectsFinishVariety: false,
  },
};
