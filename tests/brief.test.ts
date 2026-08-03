import { describe, it, expect } from 'vitest';
import { parseBrief, buildBriefPrompt, PARTS_PHYSICS } from '@/lib/brief';
import type { NailBrief } from '@/lib/brief';

const VALID: NailBrief = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'Base of every tip: sheer milky nude with a glass-like high-gloss gel finish.',
  structureLine: 'Deep French tips — the design lives only inside the tip area.',
  paletteLine: 'baby pink + baby blue on milky white',
  patternLines: ['Small polka dots inside the tip area, varied per tip.'],
  textureLine: '',
  partsLine:
    'Exactly one tip carries a single small pearl on its french boundary line. Every other tip is painted gel only — no metal, no gems, no pearls.',
  letteringWord: 'Sugar',
  moodLine: 'kawaii coquette Y2K — sweet, airy, wearable.',
  keywords: ['코케트', '파스텔'],
  colors: ['#f5c8d7', '#b8dde8', '#efe0dc'],
  difficulty: 'medium',
  feasibilityNotes: '진주는 경계선 위 1개만.',
};

describe('parseBrief', () => {
  it('유효한 JSON을 NailBrief로 파싱한다', () => {
    expect(parseBrief(JSON.stringify(VALID))).toEqual(VALID);
  });

  it('letteringWord 빈 문자열은 null로 정규화한다', () => {
    const parsed = parseBrief(JSON.stringify({ ...VALID, letteringWord: '' }));
    expect(parsed?.letteringWord).toBeNull();
  });

  it('JSON이 아니면 null', () => {
    expect(parseBrief('not json')).toBeNull();
  });

  it('허용되지 않은 shape이면 null', () => {
    expect(parseBrief(JSON.stringify({ ...VALID, shape: 'octagon' }))).toBeNull();
  });

  it('patternLines가 비어 있으면 null', () => {
    expect(parseBrief(JSON.stringify({ ...VALID, patternLines: [] }))).toBeNull();
  });

  it('필수 문자열 필드가 빠지면 null', () => {
    const { partsLine: _omit, ...rest } = VALID;
    expect(parseBrief(JSON.stringify(rest))).toBeNull();
  });
});

describe('buildBriefPrompt', () => {
  it('브리프의 핵심 라인과 파츠 물리 법칙을 포함한다', () => {
    const prompt = buildBriefPrompt(VALID);
    expect(prompt).toContain(VALID.baseLine);
    expect(prompt).toContain(VALID.partsLine);
    expect(prompt).toContain(PARTS_PHYSICS.trim().slice(2, 40)); // 물리 법칙 블록
    expect(prompt).toContain('medium almond');
  });

  it('레터링이 있으면 "written once, on one tip only"를 명시한다', () => {
    expect(buildBriefPrompt(VALID)).toContain('"Sugar" — written once, on one tip only');
  });

  it('레터링이 null이면 레터링 라인이 없다', () => {
    const prompt = buildBriefPrompt({ ...VALID, letteringWord: null });
    expect(prompt).not.toContain('cursive black script word');
  });

  it('금지 어휘(charm)가 프롬프트 자체에 등장하지 않는다', () => {
    // 단어 함정 회귀 방지: charm은 펜던트 고리를, anchor는 닻을 부른다 (PARTS_ANALYSIS 5-1절)
    const prompt = buildBriefPrompt({ ...VALID, letteringWord: null }).toLowerCase();
    expect(prompt).not.toMatch(/\bcharms?\b/);
    expect(prompt).not.toMatch(/\banchor\b/);
  });
});
