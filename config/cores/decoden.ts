import type { NailCore } from '@/lib/core';

/**
 * 데코덴·갸루 코어 — 전역 강제 규칙 전부의 반대편.
 * 참조: ref/trendy/IMG_6259.jpg (Vickeenails). 여백 0, 파츠 5+, 조소 볼륨.
 * 이 코어가 통과하면 조립기가 스타일 스펙트럼 전체를 커버한다는 뜻이다.
 */
export const decoden: NailCore = {
  id: 'decoden',
  nameKo: '데코덴·갸루',
  taglineKo: '손톱을 조형물로',
  noise: 5,

  baseLine:
    'Base of every tip: opaque milky white or sheer pink covered edge to edge — the base is a canvas to build on, not empty space to protect.',
  structure: 'full-cover',
  negativeSpace: [0, 0.15],
  designZone: {
    short:
      'Length rule (short tips): the build covers 85-100% of each tip; keep each sculpted form compact and low so the tip stays wearable at this length.',
    medium:
      'Length rule (medium tips): the build covers 85-100% of each tip, with one sculpted form rising as the centrepiece.',
    long:
      'Length rule (long tips): the build covers the whole tip and the long surface carries the largest sculpted forms, script lettering, and dense clusters together.',
  },

  textureGrammar: [
    'Sculpted gel relief rises one to three millimetres above the tip, hand-shaped before curing so each curve holds a highlight.',
    'Tone-on-tone embossed baroque scrollwork covers a tip in the same colour as its base, readable only by the shadows it casts.',
    'Domed clear gel droplets sit over finished art like beads of water caught on a surface.',
  ],
  finishMix:
    'Mix finishes across the set: several tips in high gloss, one tip in mirror chrome polished like liquid metal, one tip matte with glossy raised relief standing on it.',

  partsPhysics:
    // "anchor" 어근을 피한다 — ⚓를 그린 실측이 있다 (ref/PARTS_ANALYSIS.md 5-1절)
    'PART PHYSICS: parts are built UP in volume — sculpted gel flowers with individually shaped petals, domed pearls in graded sizes, cast metal ornaments with clean closed outlines. Each part is held by a visible gel fillet where it meets the tip and sealed with a thin clear layer over its base. The volume rises off the surface while the silhouette stays inside the tip outline.',
  partsBudget: { big: 3, studs: [6, 12] },
  allowedMaterials: ['painted', 'gel-volume', 'metal', 'pearl', 'chrome', 'sculpted'],
  motifBudget: 4,

  signature: [
    'One focal tip carries a sculpted lily or rose whose petals are shaped one at a time and rise clear of the surface.',
    'One or two tips are covered in sculpted white baroque scrollwork, raised in tone-on-tone white so shadow alone draws the pattern.',
    'One tip is packed with a cluster of three to six domed pearls in graded sizes, sitting shoulder to shoulder, each sealed under clear gel.',
    'One tip is finished in mirror chrome, polished until it reads as liquid metal.',
    'Density is the point: a tip that looks unfinished breaks the set.',
  ],

  forbidden: [
    'bare negative space left as a design choice',
    'flat decoration only',
    'a single uniform finish across the set',
    'timid single-bead accents as the main event',
  ],

  variantOps: ['material-swap', 'volume-up', 'cluster-density', 'palette-rotate', 'motif-swap'],
  attachPhoto: false,

  judge: {
    minPartsTips: 4,
    maxPartsTips: 10,
    allowGelVolume: true,
    minNegativeSpace: 0,
    requiresGelVolume: true,
    expectsFinishVariety: true,
  },
};
