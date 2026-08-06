import type { NailCore } from '@/lib/core';

/**
 * 텍스처·구미 코어 — Pinterest `3D gummy nails` 검색 +180% (스펙 2-1절).
 * 데코덴과의 결정적 차이: 파츠를 거의 쓰지 않고 질감만으로 시끄럽게 만든다.
 * 조사에서 확인된 대중 수요 지점 — "풀 장식은 망설이지만 텍스처는 원한다".
 */
export const textureGummy: NailCore = {
  id: 'texture-gummy',
  nameKo: '텍스처·구미',
  taglineKo: '파츠 없이 질감으로',
  noise: 4,

  baseLine:
    'Base of every tip: semi-sheer jelly colour with a thick chewy depth, like a gummy sweet lit from behind.',
  structure: 'full-cover',
  negativeSpace: [0.1, 0.3],
  designZone: {
    short:
      'Length rule (short tips): on every tip except the one smooth-glossy tip, the one cat-eye velvet tip, and the one mirror chrome tip, the raised texture covers the whole tip; keep each raised element small and closely spaced so the relief reads at this size.',
    medium:
      'Length rule (medium tips): on every tip except the one smooth-glossy tip, the one cat-eye velvet tip, and the one mirror chrome tip, the raised texture covers the whole tip, with the relief pattern repeating three to five times across the surface.',
    long:
      'Length rule (long tips): on every tip except the one smooth-glossy tip, the one cat-eye velvet tip, and the one mirror chrome tip, the raised texture covers the whole tip and the relief pattern can run the full length, with larger single forms welcome.',
  },

  textureGrammar: [
    'Raised gel relief is drawn as a repeating pattern — cable-knit ribs, quilted diamonds, or rolling waves — standing one to two millimetres proud of the base and reading by its own shadow.',
    'Blooming gel lets colour spread outward inside a clear layer, so the bloom on each tip comes out slightly different from the last.',
    'Domed clear gel droplets sit on top of the finished colour like water beads, each one holding a small highlight.',
  ],
  finishMix:
    'Mix finishes deliberately across the set: a matte base carrying glossy raised relief on top, one tip in cat-eye velvet, one tip in mirror chrome. Never the same finish on every tip.',

  partsPhysics:
    // "anchor" 어근을 피한다 — ⚓를 그린 실측이 있다 (ref/PARTS_ANALYSIS.md 5-1절)
    'PART PHYSICS: volume here is made of gel, not of attached parts — every raised form is gel shaped by hand before curing, held to the tip by a visible gel fillet at its base and sealed with a thin clear layer.',
  partsBudget: { big: 0, studs: [0, 2] },
  allowedMaterials: ['painted', 'gel-volume', 'chrome'],
  motifBudget: 2,

  signature: [
    'The set is a study in touch: you should be able to guess how each tip would feel under a fingertip.',
    'One tip is smooth and glossy, sitting next to a tip in deep relief — the contrast is what makes both read.',
    'Colour stays semi-sheer so light travels into the gel and comes back out, keeping the jelly depth alive.',
    'Every raised form is tone-on-tone or a half-step off the base colour, so shape carries the design rather than colour contrast.',
  ],

  forbidden: [
    'a single uniform finish across the set',
    'attached metal parts as the main event',
    'a set with no raised relief anywhere',
    'opaque chalky colour',
  ],

  variantOps: ['relief-pattern-swap', 'finish-remix', 'bloom-density', 'palette-rotate', 'rescale'],
  attachPhoto: false,

  judge: {
    minPartsTips: 0,
    maxPartsTips: 2,
    allowGelVolume: true,
    minNegativeSpace: 0.1,
    requiresGelVolume: true,
    expectsFinishVariety: true,
  },
};
