export type NailShape = 'almond' | 'round' | 'square' | 'stiletto';
export type NailLength = 'short' | 'medium' | 'long';

export interface Mood {
  keywords: string[];
  colors: string[];
}

export interface ImagePayload {
  data: string; // base64 (data URL 접두사 없음)
  mimeType: string;
}

export interface GenerateRequest {
  images: ImagePayload[];
  shape: NailShape;
  length: NailLength;
}

export interface GenerateSuccess {
  image: string; // base64
  mimeType: string;
  mood: Mood | null;
  remaining: number;
}

export type GenerateErrorCode =
  | 'INVALID_INPUT'
  | 'RATE_LIMIT_USER'
  | 'RATE_LIMIT_TOTAL'
  | 'REJECTED'
  | 'GENERATION_FAILED';
