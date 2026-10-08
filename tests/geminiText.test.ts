import { describe, expect, it } from 'vitest';
import { isUnavailable } from '@/lib/geminiText';

describe('Gemini 503 폴백 판정', () => {
  it('실측 503 오류 형태를 UNAVAILABLE로 인식한다', () => {
    // 2026-10-07 실측 응답 그대로
    const real =
      'ApiError: {"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
    expect(isUnavailable(real)).toBe(true);
  });

  it('404(모델 없음)·일반 오류에는 폴백하지 않는다', () => {
    expect(isUnavailable('ApiError: {"error":{"code":404,"status":"NOT_FOUND"}}')).toBe(false);
    expect(isUnavailable(new Error('fetch failed'))).toBe(false);
  });
});
