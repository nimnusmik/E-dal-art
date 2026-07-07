import { GoogleGenAI } from '@google/genai';
import type { ImagePayload, Mood } from './types';

export interface GeminiPart {
  inlineData?: { data: string; mimeType: string };
  text?: string;
}

export interface GeminiOutcome {
  image: ImagePayload | null;
  mood: Mood | null;
  safetyBlocked: boolean;
}

const SAFETY_REASONS = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'IMAGE_SAFETY', 'BLOCKLIST']);

function tryParseMood(text: string): Mood | null {
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { keywords, colors } = parsed as { keywords?: unknown; colors?: unknown };
    if (!Array.isArray(keywords) || !keywords.every((k) => typeof k === 'string')) return null;
    if (!Array.isArray(colors) || !colors.every((c) => typeof c === 'string')) return null;
    return { keywords, colors };
  } catch {
    return null;
  }
}

export function parseGeminiParts(parts: GeminiPart[], finishReason?: string): GeminiOutcome {
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

/** 서버 전용. 영감 사진 1~3장 + 지시문 → 네일 이미지 + 무드 텍스트 */
export async function callGemini(images: ImagePayload[], prompt: string): Promise<GeminiOutcome> {
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
