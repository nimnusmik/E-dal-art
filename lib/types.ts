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
  | 'INVITE_REQUIRED'
  | 'RATE_LIMIT_USER'
  | 'RATE_LIMIT_TOTAL'
  | 'REJECTED'
  | 'GENERATION_FAILED';
