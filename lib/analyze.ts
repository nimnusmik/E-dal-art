import { GoogleGenAI, Type } from '@google/genai';
import type { ImagePayload, Mood, NailAnalysis } from './types';

const DIFFICULTIES = new Set(['easy', 'medium', 'hard']);

/** 분석 실패 시 파이프라인을 죽이지 않기 위해 null 반환 — 라우트는 분석 없이 생성으로 폴백 */
export async function analyzeReferences(images: ImagePayload[]): Promise<NailAnalysis | null> {
  if (process.env.GEMINI_MOCK === '1') return mockAnalysis();
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [
        ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
        { text: ANALYZE_INSTRUCTION },
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: ANALYZE_SCHEMA,
      },
    });
    return parseAnalysis(response.text ?? '');
  } catch {
    return null; // 분석은 보조 단계 — 실패해도 생성은 진행
  }
}

/** 분석 결과에서 기존 Mood 형태 파생 (Seedream처럼 무드를 안 주는 생성 공급자 대비) */
export function moodFromAnalysis(analysis: NailAnalysis | null): Mood | null {
  if (!analysis) return null;
  return { keywords: analysis.keywords, colors: analysis.colors };
}

/** JSON 텍스트 → NailAnalysis. 스키마 위반 시 null (테스트 가능하도록 분리) */
export function parseAnalysis(text: string): NailAnalysis | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const a = parsed as Record<string, unknown>;
  const isStrArr = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((s) => typeof s === 'string');
  if (!isStrArr(a.keywords) || a.keywords.length === 0) return null;
  if (!isStrArr(a.colors) || a.colors.length === 0) return null;
  if (!isStrArr(a.techniques) || !isStrArr(a.parts)) return null;
  if (typeof a.baseStyle !== 'string' || typeof a.finish !== 'string') return null;
  if (typeof a.feasibilityNotes !== 'string') return null;
  if (typeof a.difficulty !== 'string' || !DIFFICULTIES.has(a.difficulty)) return null;
  return {
    keywords: a.keywords,
    colors: a.colors,
    baseStyle: a.baseStyle,
    techniques: a.techniques,
    parts: a.parts,
    finish: a.finish,
    difficulty: a.difficulty as NailAnalysis['difficulty'],
    feasibilityNotes: a.feasibilityNotes,
  };
}

const ANALYZE_INSTRUCTION = `You are a veteran Korean nail salon owner examining inspiration photos a client brought in.
Analyze the attached photo(s) and extract the design characteristics a real nail artist would need to recreate this look with gel and parts in a salon.
Rules:
- Only describe techniques that are actually achievable in a real salon (gel polish, chrome/magnetic powder, french, gradient, aurora film, hand-painted art, attachable 3D parts). If the photo shows something physically impossible on a real nail, translate it into the closest achievable technique and note the adjustment in feasibilityNotes.
- keywords: 2-3 short Korean mood keywords (e.g. "글레이즈드", "몽환").
- colors: the 3 dominant colors as #RRGGBB hex.
- baseStyle: one short English line describing the base look.
- techniques / parts: short English terms.
- finish: the surface finish (e.g. glazed glossy, matte velvet).
- difficulty: easy | medium | hard, judged as salon labor.
- feasibilityNotes: one short Korean sentence on what a human artist should adjust to make this wearable and buildable.`;

const ANALYZE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    colors: { type: Type.ARRAY, items: { type: Type.STRING } },
    baseStyle: { type: Type.STRING },
    techniques: { type: Type.ARRAY, items: { type: Type.STRING } },
    parts: { type: Type.ARRAY, items: { type: Type.STRING } },
    finish: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
    feasibilityNotes: { type: Type.STRING },
  },
  required: [
    'keywords',
    'colors',
    'baseStyle',
    'techniques',
    'parts',
    'finish',
    'difficulty',
    'feasibilityNotes',
  ],
};

/** 로컬 개발용 목 분석 (GEMINI_MOCK=1) — 실제 호출·과금 없이 전체 흐름 확인 */
async function mockAnalysis(): Promise<NailAnalysis> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    keywords: ['글레이즈드', '몽환'],
    colors: ['#e8c7d8', '#b7a6c9', '#f4ece2'],
    baseStyle: 'sheer milky pink glazed gradient',
    techniques: ['gradient', 'chrome powder', 'glazed top gel'],
    parts: ['pearl'],
    finish: 'glazed glossy',
    difficulty: 'medium',
    feasibilityNotes: '진주 파츠는 큐티클 쪽 1~2개로 줄이면 일상 착용이 편해요.',
  };
}
