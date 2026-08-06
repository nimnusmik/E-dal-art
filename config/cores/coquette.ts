import type { NailCore } from '@/lib/core';

/**
 * 코케트 코어 — 유일하게 검증 완료된 헌법 (ref/trendy/STYLE_ANALYSIS.md v2).
 * 문장은 lib/brief.ts의 PARTS_PHYSICS·LENGTH_RULES에서 그대로 이식했다.
 * 여기를 고치면 기준선이 무효가 되므로, 실측 없이 문장을 바꾸지 않는다.
 */
export const coquette: NailCore = {
  id: 'coquette',
  nameKo: '코케트',
  taglineKo: '소녀 시절 아카이브를 어른의 절제로',
  noise: 3,

  baseLine: 'Base of every tip: sheer milky nude with a glass-like high-gloss gel finish.',
  structure: 'deep-french',
  // STYLE_ANALYSIS.md E절: 여백률 55~70%
  negativeSpace: [0.55, 0.7],
  designZone: {
    short:
      'Length rule (short tips): the design zone shrinks to 20-30% of each nail — keep every motif micro-scale: micro dots (0.5-1mm) and thin 0.5mm lines only, each element flat-painted and fully contained inside that compact zone.',
    medium:
      'Length rule (medium tips): the design zone covers 30-45% of each nail — standard deep-french depth.',
    long:
      'Length rule (long tips): the design zone may run deep — deep-french coverage, script lettering, and a single centerpiece part on one hero tip are all welcome.',
  },

  textureGrammar: [],
  finishMix: 'One single finish across the whole set: glass-like high gloss on every tip.',

  // lib/brief.ts:192 PARTS_PHYSICS 이식, 선행 "- " 제거 (프롬프트 조립기가 불릿 공급)
  partsPhysics:
    'METAL PART PHYSICS: every metal part is a FLAT embossed metal stud lying flush ON the nail surface, sealed under a layer of clear gel — glued down like a sticker with slight thickness. Each stud is a SOLID CAST shape with a clean closed outline, exactly the motif silhouette and nothing more. The stud stays fully inside the nail\'s outline.',
  // STYLE_ANALYSIS.md E절: 빅참 1개 + 미니 스터드 3~6개
  partsBudget: { big: 1, studs: [3, 6] },
  allowedMaterials: ['painted', 'metal', 'pearl'],
  motifBudget: 3,

  signature: [
    'The design lives only inside the deep-french tip zone; the nude zone above the boundary stays empty and glossy, and that emptiness is the point.',
    // STYLE_ANALYSIS C절의 "앵커" 역할. 영어 anchor는 ⚓를 그리므로 focal tip으로 쓴다
    'Across the set one tip is the focal tip (script lettering or a single centerpiece part), two or three tips are rhythm variations of the same motif, and one tip stays almost bare nude.',
    'The same motif returns in different materials across the set: a painted dot on one tip, a metal stud dot on another, a pearl on a third.',
    'The tip boundary is a smile line by default, occasionally redrawn as a clean diagonal or straight line.',
  ],

  // STYLE_ANALYSIS.md G절: 12장 전체에서 0회 등장한 것들
  forbidden: [
    'marble veining',
    'chunky full-cover glitter',
    'ombre gradient french',
    'matte finish',
    'neon or vivid saturation',
    'full-surface pattern with no french boundary',
    'parts that hang, dangle, or swing',
    'parts taller than the nail curve',
  ],

  variantOps: ['invert', 'rescale', 'density', 'zero-parts', 'boundary-swap'],
  attachPhoto: false,

  judge: {
    minPartsTips: 1,
    maxPartsTips: 2,
    allowGelVolume: false,
    minNegativeSpace: 0.55,
    requiresGelVolume: false,
    expectsFinishVariety: false,
  },
};
