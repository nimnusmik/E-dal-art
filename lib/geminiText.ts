import { GoogleGenAI } from '@google/genai';

/**
 * Gemini 텍스트·비전 호출 공용 진입점 (분석·플랜·심사).
 *
 * 503(수요 폭주) 폴백: 기본 모델이 UNAVAILABLE이면 예비 모델로 1회 재시도.
 * 분석 실패 = 세션 시작 불가이므로, 모델 하나가 죽어도 서비스가 서있게 한다.
 * (2026-10-07 실측: gemini-3.5-flash가 수 시간 503인 동안 2.5-flash는 정상)
 */

const FALLBACK_MODEL = 'gemini-2.5-flash';

function primaryModel(): string {
  return process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
}

export function isUnavailable(e: unknown): boolean {
  return /UNAVAILABLE|"code"\s*:\s*503|high demand|overloaded/i.test(String(e));
}

type GenerateParams = Omit<
  Parameters<GoogleGenAI['models']['generateContent']>[0],
  'model'
>;

type Part = { text?: string; inlineData?: { data: string; mimeType: string } };

/** Gemini 스키마(type: "OBJECT")를 JSON Schema(type: "object")로. 나머지 키는 그대로 */
export function toJsonSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toJsonSchema);
  if (!s || typeof s !== 'object') return s;
  return Object.fromEntries(
    Object.entries(s).map(([k, v]) => [k, k === 'type' && typeof v === 'string' ? v.toLowerCase() : toJsonSchema(v)]),
  );
}

/**
 * Meta Model API(OpenAI 호환 chat/completions)로 같은 요청을 보낸다. TEXT_PROVIDER=muse 일 때.
 * 호출부가 Gemini 형식(contents·responseSchema)으로 쓰여 있어 여기서 번역하고,
 * 반환도 Gemini처럼 { text }만 맞춘다 — 호출부는 response.text만 읽는다.
 */
export function toMuseBody(params: GenerateParams, model: string) {
  const parts = params.contents as Part[];
  const content = parts.map((p) =>
    p.inlineData
      ? { type: 'image_url', image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } }
      : { type: 'text', text: p.text ?? '' },
  );
  const schema = params.config?.responseSchema;
  return {
    model,
    messages: [{ role: 'user', content }],
    ...(schema
      ? { response_format: { type: 'json_schema', json_schema: { name: 'out', schema: toJsonSchema(schema) } } }
      : {}),
  };
}

async function museGenerate(params: GenerateParams): Promise<{ text: string }> {
  const res = await fetch('https://api.meta.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.MODEL_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(toMuseBody(params, process.env.MUSE_TEXT_MODEL ?? 'muse-spark-1.3')),
  });
  const json = (await res.json().catch(() => null)) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { code?: string; message?: string };
  } | null;
  if (!res.ok) throw new Error(`Muse chat ${res.status}: ${json?.error?.code ?? ''} ${json?.error?.message ?? ''}`);
  return { text: json?.choices?.[0]?.message?.content ?? '' };
}

/** generateContent + 503 폴백. 그 외 오류는 그대로 던진다 (호출부 재시도 정책 유지) */
export async function analyzeGenerate(params: GenerateParams) {
  if (process.env.TEXT_PROVIDER === 'muse') return museGenerate(params);
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = primaryModel();
  try {
    return await client.models.generateContent({ model, ...params });
  } catch (e) {
    if (!isUnavailable(e) || model === FALLBACK_MODEL) throw e;
    return client.models.generateContent({ model: FALLBACK_MODEL, ...params });
  }
}
