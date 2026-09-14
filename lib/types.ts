export type NailShape = 'almond' | 'round' | 'square' | 'stiletto';
export type NailLength = 'short' | 'medium' | 'long';

/** 파츠 강도 옵션 (docs/api-variants-contract.md 공통 타입).
 *  auto: 사진의 파츠 밀도 그대로 / none: 파츠 0 / point: 포인트 1~2개 / rich: 화려하게 */
export type PartsIntensity = 'auto' | 'none' | 'point' | 'rich';

/** 5종 변주 플랜 — 베이스 브리프의 일부 라인을 대체하는 델타 (docs/api-variants-contract.md) */
export interface VariantPlan {
  id: string;            // "v1"~"v5"
  title: string;         // 한국어 짧은 이름 (예: "도트 반전", "레이스 포인트") — UI 카드 라벨
  patternLines: string[]; // 베이스 브리프의 patternLines를 대체
  partsLine: string;      // 베이스 브리프의 partsLine을 대체
  letteringWord: string | null;
  paletteLine?: string;   // 없으면 베이스 브리프 것 사용
  /**
   * 카드에 붙는 한국어 한 줄 — "이 시안이 다른 넷과 무엇이 다른가".
   * 이름만 있으면 사용자에게는 무작위 단어 5개이고, "왜 5장인가"에 화면이 답하지 못한다.
   */
  note?: string;
}

export interface Mood {
  keywords: string[];
  colors: string[];
}

/**
 * 1단계(분석)의 구조화 산출물. 참조 사진에서 뽑은 디자인 특징으로,
 * 2단계 생성 프롬프트의 재료이자 상품 텍스트(무드·시술 난이도·재료 힌트)의 원천.
 */
export interface NailAnalysis {
  /** 한국어 무드 키워드 2~3개 (기존 Mood.keywords와 동일 용도) */
  keywords: string[];
  /** 지배 색상 3개, #RRGGBB */
  colors: string[];
  /** 베이스 스타일 한 줄 요약 (예: sheer milky pink gradient) */
  baseStyle: string;
  /** 사용된 기법 (예: french tip, chrome powder, aurora film) */
  techniques: string[];
  /** 파츠·장식 (예: pearl, 3d ribbon). 없으면 빈 배열 */
  parts: string[];
  /** 마감 질감 (예: glazed glossy, matte velvet) */
  finish: string;
  /** 실제 시술 난이도 */
  difficulty: 'easy' | 'medium' | 'hard';
  /** 시술 가능성 메모 — 사람 아티스트가 재현할 때 조정이 필요한 요소 */
  feasibilityNotes: string;
}

export interface ImagePayload {
  data: string; // base64 (data URL 접두사 없음)
  mimeType: string;
}

/** 이미지 생성 공급자(Gemini·Seedream) 공통 결과 형태 */
export interface ImageOutcome {
  image: ImagePayload | null;
  mood: Mood | null;
  safetyBlocked: boolean;
}

export interface GenerateRequest {
  images: ImagePayload[];
  shape: NailShape;
  length: NailLength;
}

export interface GeneratedImage {
  image: string; // base64
  mimeType: string;
}

export interface GenerateSuccess {
  hero: GeneratedImage; // 손 착용샷 (콜라주 히어로)
  tipSet: GeneratedImage | null; // 개별 팁 10개 플랫레이 (실패 시 null)
  mood: Mood | null;
  remaining: number;
}

export type GenerateErrorCode =
  | 'INVALID_INPUT'
  | 'RATE_LIMIT_USER'
  | 'RATE_LIMIT_TOTAL'
  | 'REJECTED'
  | 'GENERATION_FAILED';
