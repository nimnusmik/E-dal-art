import { describe, it, expect } from 'vitest';
import { buildBriefPrompt } from '@/lib/brief';
import type { NailBrief } from '@/lib/brief';

/**
 * 기존 코케트 경로의 회귀 가드.
 * 코어 리팩터링 중 lib/brief.ts의 기존 프롬프트가 바뀌면 여기서 잡힌다.
 * 이 스냅샷은 "현재 검증된 유일한 자산"이므로 의도적 변경 없이는 갱신 금지.
 */
const BASELINE_BRIEF: NailBrief = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'Base of every tip: sheer milky nude with a glass-like high-gloss gel finish.',
  structureLine:
    'Deep French tips — the design lives only inside the tip area, nude zone above stays empty and glossy.',
  paletteLine: 'baby pink + baby blue on milky white',
  patternLines: ['Small polka dots inside the tip area, varied in scale and density per tip.'],
  textureLine: '',
  partsLine:
    'Exactly one tip carries a single small pearl on its french boundary line. Every other tip is painted gel only — no metal, no gems, no pearls.',
  letteringWord: 'Sugar',
  moodLine: 'kawaii coquette Y2K — sweet, airy, wearable.',
  keywords: ['코케트', '파스텔'],
  colors: ['#f5c8d7', '#b8dde8', '#efe0dc'],
  difficulty: 'medium',
  feasibilityNotes: '도트는 도트봉으로 시술 가능.',
};

describe('기존 코케트 프롬프트 (회귀 가드)', () => {
  it('프롬프트 문자열이 스냅샷과 일치한다', () => {
    expect(buildBriefPrompt(BASELINE_BRIEF)).toMatchSnapshot();
  });

  it('하중 제약이 모두 남아 있다', () => {
    const prompt = buildBriefPrompt(BASELINE_BRIEF);
    expect(prompt).toContain('METAL PART PHYSICS');
    expect(prompt).toContain('30-45%');
    expect(prompt).toContain('PARTS RULE');
    expect(prompt).toContain('Sugar');
    expect(prompt).toContain('hand-paintable by a human artist');
  });
});
