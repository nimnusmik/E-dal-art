import { describe, it, expect, afterEach } from 'vitest';
import { getTrendKeywords, DEFAULT_TREND_KEYWORDS } from '@/config/trends';
import { buildPrompt } from '@/lib/prompt';

afterEach(() => {
  delete process.env.TREND_KEYWORDS;
});

describe('getTrendKeywords', () => {
  it('env 없으면 기본값', () => {
    expect(getTrendKeywords()).toEqual(DEFAULT_TREND_KEYWORDS);
  });

  it('env 있으면 쉼표 분리 + 공백 정리', () => {
    process.env.TREND_KEYWORDS = ' chrome hearts , cheek nail ';
    expect(getTrendKeywords()).toEqual(['chrome hearts', 'cheek nail']);
  });

  it('env가 빈 문자열이면 기본값', () => {
    process.env.TREND_KEYWORDS = '  ';
    expect(getTrendKeywords()).toEqual(DEFAULT_TREND_KEYWORDS);
  });
});

describe('buildPrompt', () => {
  const prompt = buildPrompt('almond', 'short', ['glazed donut'], 2);

  it('모양·길이 반영', () => {
    expect(prompt).toContain('almond');
    expect(prompt).toContain('short');
  });

  it('트렌드 키워드 포함', () => {
    expect(prompt).toContain('glazed donut');
  });

  it('여러 장이면 종합 지시 포함', () => {
    expect(prompt).toContain('ALL 2 attached');
  });

  it('한 장이면 단수 표현', () => {
    const single = buildPrompt('round', 'long', [], 1);
    expect(single).toContain('the attached inspiration photo');
  });

  it('JSON 응답 형식 요구 포함', () => {
    expect(prompt).toContain('"keywords"');
    expect(prompt).toContain('"colors"');
  });
});
