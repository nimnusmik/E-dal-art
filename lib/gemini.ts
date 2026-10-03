import { GoogleGenAI } from '@google/genai';
import type { ImageOutcome, ImagePayload, Mood } from './types';
import { isMock } from './mock';

export interface GeminiPart {
  inlineData?: { data: string; mimeType: string };
  text?: string;
}

/** @deprecated 공유 타입 ImageOutcome 사용 */
export type GeminiOutcome = ImageOutcome;

const SAFETY_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY', 'BLOCKLIST']);

function tryParseMoodCandidate(candidate: string): Mood | null {
  try {
    const parsed: unknown = JSON.parse(candidate);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { keywords, colors } = parsed as { keywords?: unknown; colors?: unknown };
    if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === 'string')) return null;
    if (!Array.isArray(colors) || !colors.every((c) => typeof c === 'string')) return null;
    return { keywords, colors };
  } catch {
    return null;
  }
}

function tryParseMood(text: string): Mood | null {
  const matches = text.match(/\{[^{}]*\}/g);
  if (!matches) return null;
  // 잡담 속 stray brace로 인해 앞쪽 후보가 잘못 매칭될 수 있으므로,
  // 뒤에서부터 훑어 처음으로 유효한 Mood를 반환한다.
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const mood = tryParseMoodCandidate(matches[i]);
    if (mood) return mood;
  }
  return null;
}

export function parseGeminiParts(parts: GeminiPart[], finishReason?: string): ImageOutcome {
  let image: ImagePayload | null = null;
  let mood: Mood | null = null;
  for (const part of parts) {
    if (part.inlineData && !image) {
      image = { data: part.inlineData.data, mimeType: part.inlineData.mimeType };
    }
    if (part.text && !mood) {
      mood = tryParseMood(part.text);
    }
  }
  return {
    image,
    mood,
    safetyBlocked: finishReason !== undefined && SAFETY_REASONS.has(finishReason),
  };
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/**
 * 로컬 개발용 목 응답 (IMAGE_MOCK=1). 실제 API 호출·과금 없이
 * ref/ 샘플 이미지로 전체 흐름(쿼터·콜라주·저장)을 확인한다.
 */
async function mockGemini(): Promise<ImageOutcome> {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const file = await readFile(path.join(process.cwd(), 'ref', 'Nails.jpeg'));
  await new Promise((r) => setTimeout(r, 2000)); // 생성 지연 흉내
  return {
    image: { data: file.toString('base64'), mimeType: 'image/jpeg' },
    mood: { keywords: ['글레이즈드', '몽환'], colors: ['#e8c7d8', '#b7a6c9', '#f4ece2'] },
    safetyBlocked: false,
  };
}

/** 서버 전용. 영감 사진 1~3장 + 지시문 → 네일 이미지 + 무드 텍스트 */
export async function callGemini(images: ImagePayload[], prompt: string): Promise<ImageOutcome> {
  if (isMock()) return mockGemini();
  const model = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image';
  const response = await getClient().models.generateContent({
    model,
    contents: [
      ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
      { text: prompt },
    ],
    config: { responseModalities: ['IMAGE', 'TEXT'] },
  });
  const candidate = response.candidates?.[0];
  const parts = (candidate?.content?.parts ?? []) as GeminiPart[];
  return parseGeminiParts(parts, candidate?.finishReason as string | undefined);
}
