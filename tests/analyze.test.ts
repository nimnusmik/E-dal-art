import { describe, it, expect, afterEach } from 'vitest';
import { analyzeReferences, moodFromAnalysis, parseAnalysis } from '@/lib/analyze';
import { buildAnalysisBrief, buildPrompt, buildTipSetPrompt } from '@/lib/prompt';
import type { NailAnalysis } from '@/lib/types';

const VALID: NailAnalysis = {
  keywords: ['글레이즈드', '몽환'],
  colors: ['#e8c7d8', '#b7a6c9', '#f4ece2'],
  baseStyle: 'sheer milky pink glazed gradient',
  techniques: ['gradient', 'chrome powder'],
  parts: ['pearl'],
  finish: 'glazed glossy',
  difficulty: 'medium',
  feasibilityNotes: '진주 파츠는 1~2개로 줄이면 좋아요.',
};

afterEach(() => {
  delete process.env.GEMINI_MOCK;
});

describe('parseAnalysis', () => {
  it('유효한 JSON이면 NailAnalysis 반환', () => {
    expect(parseAnalysis(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('JSON이 아니면 null', () => {
    expect(parseAnalysis('not json')).toBeNull();
  });

  it('difficulty가 허용값이 아니면 null', () => {
    expect(parseAnalysis(JSON.stringify({ ...VALID, difficulty: 'impossible' }))).toBeNull();
  });

  it('keywords가 비면 null', () => {
    expect(parseAnalysis(JSON.stringify({ ...VALID, keywords: [] }))).toBeNull();
  });

  it('필수 문자열 필드 누락이면 null', () => {
    const { baseStyle: _omit, ...rest } = VALID;
    expect(parseAnalysis(JSON.stringify(rest))).toBeNull();
  });
});

describe('analyzeReferences (mock)', () => {
  it('GEMINI_MOCK=1이면 목 분석 반환', async () => {
    process.env.GEMINI_MOCK = '1';
    const analysis = await analyzeReferences([]);
    expect(analysis).not.toBeNull();
    expect(analysis?.difficulty).toBe('medium');
    expect(analysis?.keywords.length).toBeGreaterThan(0);
  });
});

describe('moodFromAnalysis', () => {
  it('분석에서 Mood 파생', () => {
    expect(moodFromAnalysis(VALID)).toEqual({ keywords: VALID.keywords, colors: VALID.colors });
  });

  it('null이면 null', () => {
    expect(moodFromAnalysis(null)).toBeNull();
  });
});

describe('buildAnalysisBrief', () => {
  it('분석이 있으면 브리프 라인 생성', () => {
    const brief = buildAnalysisBrief(VALID);
    expect(brief).toContain('sheer milky pink glazed gradient');
    expect(brief).toContain('chrome powder');
    expect(brief).toContain('#e8c7d8');
    expect(brief).toContain('pearl');
  });

  it('파츠가 없으면 Parts 라인 생략', () => {
    expect(buildAnalysisBrief({ ...VALID, parts: [] })).not.toContain('Parts:');
  });

  it('null이면 빈 문자열 (기존 프롬프트와 동일)', () => {
    expect(buildAnalysisBrief(null)).toBe('');
  });
});

describe('프롬프트에 분석 브리프 주입', () => {
  it('buildPrompt에 브리프 포함', () => {
    const prompt = buildPrompt('almond', 'short', [], 1, false, VALID);
    expect(prompt).toContain('Design brief');
    expect(prompt).toContain('glazed glossy');
  });

  it('buildTipSetPrompt에 브리프 포함', () => {
    const prompt = buildTipSetPrompt('almond', 'short', [], 1, VALID);
    expect(prompt).toContain('Design brief');
  });

  it('분석 없으면 브리프 미포함 (하위 호환)', () => {
    expect(buildPrompt('almond', 'short', [], 1)).not.toContain('Design brief');
    expect(buildTipSetPrompt('almond', 'short', [], 1)).not.toContain('Design brief');
  });

  it('사람 아티스트 리얼리즘 제약 포함', () => {
    const hero = buildPrompt('almond', 'short', [], 1);
    const tips = buildTipSetPrompt('almond', 'short', [], 1);
    for (const p of [hero, tips]) {
      expect(p).toContain('human nail artist');
      expect(p).toMatch(/physically buildable/i);
    }
  });

  it('식상한 모티프 금지 제약 포함 (도넛·리본 등)', () => {
    const hero = buildPrompt('almond', 'short', [], 1);
    const tips = buildTipSetPrompt('almond', 'short', [], 1);
    for (const p of [hero, tips]) {
      expect(p).toContain('Banned clichés');
      expect(p).toContain('donut');
      expect(p).toContain('ribbon bows');
    }
  });

  it('히어로 구도: 손 하나·손가락당 손톱 하나·이탈 손톱 금지', () => {
    const hero = buildPrompt('almond', 'short', [], 1);
    expect(hero).toContain('ONE relaxed real hand');
    expect(hero).toContain('No detached nails');
  });
});
