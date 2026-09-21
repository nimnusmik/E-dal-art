import type { ImageOutcome, ImagePayload } from './types';
import { isMock } from './mock';

const DEFAULT_BASE_URL = 'https://ark.ap-southeast.bytepluses.com/api/v3';
const DEFAULT_MODEL = 'seedream-4-0';

export interface SeedreamImage {
  b64_json?: string;
  url?: string;
}

export interface SeedreamResponse {
  data?: SeedreamImage[];
}

/** base64 앞머리로 이미지 포맷 추정 (Seedream은 mimeType을 따로 주지 않음) */
export function sniffMime(b64: string): string {
  if (b64.startsWith('/9j/')) return 'image/jpeg';
  if (b64.startsWith('iVBORw0KGgo')) return 'image/png';
  return 'image/png';
}

/** 콘텐츠 정책(민감/유해) 차단 여부 — REJECTED(422)로 매핑하기 위한 판별 */
export function isModerationError(payload: unknown): boolean {
  const text = JSON.stringify(payload ?? '').toLowerCase();
  return /sensitive|moderation|content.?policy|prohibited|violat|risk/.test(text);
}

export function parseSeedreamResponse(json: SeedreamResponse): ImageOutcome {
  const first = json.data?.[0];
  if (first?.b64_json) {
    return {
      image: { data: first.b64_json, mimeType: sniffMime(first.b64_json) },
      mood: null, // Seedream은 무드 텍스트를 반환하지 않음 → 색상은 클라이언트에서 추출
      safetyBlocked: false,
    };
  }
  return { image: null, mood: null, safetyBlocked: false };
}

/** 로컬 개발용 목 응답 (IMAGE_MOCK=1). 실제 호출·과금 없이 흐름 확인 */
async function mockSeedream(): Promise<ImageOutcome> {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const file = await readFile(path.join(process.cwd(), 'ref', 'Nails.jpeg'));
  await new Promise((r) => setTimeout(r, 2000));
  return {
    image: { data: file.toString('base64'), mimeType: 'image/jpeg' },
    mood: null, // 실제 Seedream처럼 무드 없음 → 색상 자동 추출 경로를 탐
    safetyBlocked: false,
  };
}

/** 서버 전용. 영감 사진 1~3장 + 지시문 → 네일 이미지 (무드는 클라이언트에서 색상 추출) */
export async function callSeedream(images: ImagePayload[], prompt: string): Promise<ImageOutcome> {
  if (isMock()) return mockSeedream();
  const base = process.env.SEEDREAM_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.SEEDREAM_MODEL ?? DEFAULT_MODEL;
  const res = await fetch(`${base}/images/generations`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.SEEDREAM_API_KEY ?? ''}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      image: images.map((img) => `data:${img.mimeType};base64,${img.data}`),
      response_format: 'b64_json',
      watermark: false,
    }),
  });
  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // 본문 파싱 실패는 무시하고 일반 실패로 처리
    }
    if (isModerationError(payload)) return { image: null, mood: null, safetyBlocked: true };
    throw new Error(`seedream ${res.status}`);
  }
  return parseSeedreamResponse((await res.json()) as SeedreamResponse);
}
