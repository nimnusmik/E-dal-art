import { describe, it, expect } from 'vitest';
import { parseGeminiParts } from '@/lib/gemini';

const IMG = { inlineData: { data: 'aGVsbG8=', mimeType: 'image/png' } };

describe('parseGeminiParts', () => {
  it('이미지 + JSON 텍스트를 함께 파싱', () => {
    const out = parseGeminiParts([
      IMG,
      { text: '{"keywords": ["청량한 아쿠아", "글레이즈드"], "colors": ["#a0e8f0", "#ffffff", "#d4f0e0"]}' },
    ]);
    expect(out.image).toEqual({ data: 'aGVsbG8=', mimeType: 'image/png' });
    expect(out.mood).toEqual({
      keywords: ['청량한 아쿠아', '글레이즈드'],
      colors: ['#a0e8f0', '#ffffff', '#d4f0e0'],
    });
    expect(out.safetyBlocked).toBe(false);
  });

  it('텍스트에 잡담이 섞여도 첫 JSON 객체를 추출', () => {
    const out = parseGeminiParts([
      IMG,
      { text: 'Here is your design!\n{"keywords": ["몽환"], "colors": ["#eee"]}\nEnjoy!' },
    ]);
    expect(out.mood?.keywords).toEqual(['몽환']);
  });

  it('JSON 파싱 실패 시 mood는 null, 이미지는 유지 (스펙: 생성 실패로 처리하지 않음)', () => {
    const out = parseGeminiParts([IMG, { text: 'not json at all' }]);
    expect(out.image).not.toBeNull();
    expect(out.mood).toBeNull();
  });

  it('JSON 형태가 틀리면 (keywords가 배열 아님) mood는 null', () => {
    const out = parseGeminiParts([IMG, { text: '{"keywords": "글레이즈드", "colors": []}' }]);
    expect(out.mood).toBeNull();
  });

  it('이미지 없으면 image null', () => {
    const out = parseGeminiParts([{ text: 'sorry' }]);
    expect(out.image).toBeNull();
  });

  it('finishReason SAFETY → safetyBlocked', () => {
    const out = parseGeminiParts([], 'SAFETY');
    expect(out.safetyBlocked).toBe(true);
  });

  it('finishReason PROHIBITED_CONTENT → safetyBlocked', () => {
    const out = parseGeminiParts([], 'PROHIBITED_CONTENT');
    expect(out.safetyBlocked).toBe(true);
  });
});
