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

/** generateContent + 503 폴백. 그 외 오류는 그대로 던진다 (호출부 재시도 정책 유지) */
export async function analyzeGenerate(params: GenerateParams) {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const model = primaryModel();
  try {
    return await client.models.generateContent({ model, ...params });
  } catch (e) {
    if (!isUnavailable(e) || model === FALLBACK_MODEL) throw e;
    return client.models.generateContent({ model: FALLBACK_MODEL, ...params });
  }
}
