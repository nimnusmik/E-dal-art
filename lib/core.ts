/**
 * 코어(-core) = 사용자가 선택하는 미감 정체성 = 독립된 프롬프트 헌법.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-06-nail-core-presets-design.md
 * 기존에 lib/prompt.ts·lib/brief.ts에 전역으로 강제되던 스타일 규칙
 * (PARTS_PHYSICS·LENGTH_RULES·HUMAN_ARTIST_LINES)을 이 레코드로 옮긴다.
 * 전역에 남는 것은 UNIVERSAL_RULES 4줄뿐.
 */

/** 파츠·모티프의 재질. 사진 재질 보존 판정(D7)에 사용 */
export type Material = 'painted' | 'gel-volume' | 'metal' | 'pearl' | 'chrome' | 'sculpted';

export type CoreStructure = 'one-tone' | 'french' | 'deep-french' | 'full-cover' | 'layered-sheer';

export type LengthKey = 'short' | 'medium' | 'long';

export interface NailCore {
  id: string;
  /** 사용자 노출 — 한국어 */
  nameKo: string;
  /** 카드 설명 한 줄 — 한국어 */
  taglineKo: string;
  /** 소음 지수. UI 그리드 정렬 순서 = 이 값 오름차순 */
  noise: 1 | 2 | 3 | 4 | 5;

  // ── 구조 (영어) ──
  baseLine: string;
  structure: CoreStructure;
  /** 여백률 범위 [min, max] */
  negativeSpace: [number, number];
  /** 기존 LENGTH_RULES 대체 — 길이별 디자인 영역 규칙 */
  designZone: Record<LengthKey, string>;

  // ── 질감·마감 ──
  textureGrammar: string[];
  finishMix: string;

  // ── 파츠 ──
  partsPhysics: string;
  partsBudget: { big: number; studs: [number, number] };
  /** 사진 재질 보존 판정용 — 이 코어가 다룰 수 있는 재질 */
  allowedMaterials: Material[];
  /** 이 코어가 한 세트에서 소화할 사진 모티프 최대 개수 */
  motifBudget: number;

  // ── 개성 (자유 작문 3~5줄) ──
  signature: string[];

  // ── 제약 (이 코어에서만) ──
  forbidden: string[];

  /** 변주 연산자 — 코어 정체성을 깨지 않는 것만 */
  variantOps: string[];

  /** 생성 시 원본 사진을 모델에 첨부할지 (D6 — 3단계 실측에서 확정) */
  attachPhoto: boolean;

  judge: {
    minPartsTips: number;
    maxPartsTips: number;
    allowGelVolume: boolean;
    minNegativeSpace: number;
  };
}

/**
 * 15개 코어 전부에 적용되는 공통분모. 이 4줄 외의 모든 스타일 규칙은
 * 코어 레코드가 소유한다. (팁셋 플랫레이 기준 — 손 착용샷 규칙은 lib/prompt.ts에 남아 있음)
 */
export const UNIVERSAL_RULES: string[] = [
  'Every element is physically buildable by hand with gel, powder, film, and attachable parts, each part sealed under a layer of clear gel.',
  "The render reads as a photograph of real finished nail tips: each tip's own outline is crisp and unwarped, and every material renders honestly, with no melted or smeared silhouette edges.",
  'Keep believable hand-made character: micro-variations between tips, natural gel thickness and edge highlights, not computer-perfect symmetry.',
  'Keep it abstract nail art: no eyes, eyeballs, iris or pupil shapes, no faces.',
];

import { CORES } from '@/config/cores';

export function allCores(): NailCore[] {
  return CORES;
}

export function getCore(id: string): NailCore | null {
  return CORES.find((c) => c.id === id) ?? null;
}
