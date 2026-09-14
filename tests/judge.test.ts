import { describe, it, expect } from 'vitest';
import { parseJudgement, expectedMetalTips, verdict, verdictDetail } from '@/lib/judge';
import type { NailJudgement } from '@/lib/judge';
import type { NailBrief } from '@/lib/brief';

const BRIEF: NailBrief = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'sheer milky nude base',
  structureLine: 'deep french tips',
  paletteLine: 'baby pink + baby blue',
  patternLines: ['polka dots'],
  textureLine: '',
  partsLine:
    'Exactly one tip carries a single small pearl on its french boundary line. Every other tip is painted gel only — no metal, no gems, no pearls.',
  letteringWord: 'Sugar',
  moodLine: 'coquette',
  keywords: ['코케트'],
  colors: ['#f5c8d7'],
  difficulty: 'medium',
  feasibilityNotes: '',
};

const CLEAN: NailJudgement = {
  baseMatch: true,
  paletteMatch: true,
  partsMatch: true,
  metalTipCount: 1,
  letteringCount: 1,
  physicsOk: true,
  cleanRender: true,
  notes: '통과',
};

describe('expectedMetalTips', () => {
  it('"exactly one" → 1±1 범위', () => {
    expect(expectedMetalTips(BRIEF)).toEqual({ min: 0, max: 2 });
  });

  it('복수 지정("exactly one" + "exactly three")은 합산한다', () => {
    const brief = {
      ...BRIEF,
      partsLine:
        'Exactly one tip features a rose. Exactly three tips feature tiny silver microbeads. Every other tip is painted gel only.',
    };
    expect(expectedMetalTips(brief)).toEqual({ min: 3, max: 5 });
  });

  it('파츠 없는 세트("no metal", carries 없음) → 0', () => {
    const brief = {
      ...BRIEF,
      partsLine: 'Every tip is painted gel only — no metal, no gems, no pearls, no 3D parts.',
    };
    expect(expectedMetalTips(brief)).toEqual({ min: 0, max: 0 });
  });
});

describe('verdict', () => {
  it('전 항목 충족이면 통과 (6/6)', () => {
    expect(verdict(CLEAN, BRIEF)).toEqual({ pass: true, score: 6 });
  });

  it('파츠 개수 초과(도배)는 즉시 탈락 — 1차 파일럿의 은색 볼 도배 회귀 방지', () => {
    const v = verdict({ ...CLEAN, metalTipCount: 9 }, BRIEF);
    expect(v.pass).toBe(false);
  });

  it('물리 위반(매달린 파츠)은 다른 항목이 만점이어도 탈락', () => {
    expect(verdict({ ...CLEAN, physicsOk: false }, BRIEF).pass).toBe(false);
  });

  it('AI 렌더 티는 탈락', () => {
    expect(verdict({ ...CLEAN, cleanRender: false }, BRIEF).pass).toBe(false);
  });

  it('레터링 중복(2회)은 감점 — 5/6으로 통과 경계', () => {
    const v = verdict({ ...CLEAN, letteringCount: 2 }, BRIEF);
    expect(v.score).toBe(5);
    expect(v.pass).toBe(true); // 레터링은 즉시 탈락 사유가 아님
  });

  it('팔레트 이탈 + 레터링 중복이 겹치면 4/6 탈락', () => {
    const v = verdict({ ...CLEAN, paletteMatch: false, letteringCount: 2 }, BRIEF);
    expect(v).toEqual({ pass: false, score: 4 });
  });

  it('레터링 없는 브리프에서 레터링이 등장하면 감점', () => {
    const brief = { ...BRIEF, letteringWord: null };
    const v = verdict({ ...CLEAN, letteringCount: 1 }, brief);
    expect(v.score).toBe(5);
  });
});

describe('parseJudgement', () => {
  it('유효한 JSON을 파싱한다', () => {
    expect(parseJudgement(JSON.stringify(CLEAN))).toEqual(CLEAN);
  });

  it('boolean 필드가 문자열이면 null', () => {
    expect(parseJudgement(JSON.stringify({ ...CLEAN, physicsOk: 'true' }))).toBeNull();
  });

  it('개수 필드가 없으면 null', () => {
    const { metalTipCount: _omit, ...rest } = CLEAN;
    expect(parseJudgement(JSON.stringify(rest))).toBeNull();
  });

  it('JSON이 아니면 null', () => {
    expect(parseJudgement('oops')).toBeNull();
  });
});

describe('verdictDetail — 검수 근거 노출', () => {
  const BRIEF = {
    shape: 'almond', length: 'medium',
    baseLine: 'sheer milky nude', structureLine: 'deep french',
    paletteLine: 'baby pink', patternLines: ['dots'], textureLine: '',
    partsLine: 'Every tip is painted gel only — no metal, no gems, no pearls, no 3D parts.',
    letteringWord: null, moodLine: 'coquette', keywords: ['코케트'],
    colors: ['#f5c8d7'], difficulty: 'medium', feasibilityNotes: '',
  } satisfies NailBrief;

  const CLEAN = {
    baseMatch: true, paletteMatch: true, partsMatch: true,
    metalTipCount: 0, letteringCount: 0, physicsOk: true, cleanRender: true,
    notes: '깔끔합니다',
  };

  it('통과작은 심사평을 싣고 미달 항목이 비어 있다', () => {
    const r = verdictDetail(CLEAN, BRIEF);
    expect(r.pass).toBe(true);
    expect(r.notes).toBe('깔끔합니다');
    expect(r.issues).toEqual([]);
    expect(r.maxScore).toBe(6);
  });

  it('낙제작은 "왜 아쉬운지"를 한국어로 알려준다', () => {
    const r = verdictDetail({ ...CLEAN, physicsOk: false, cleanRender: false }, BRIEF);
    expect(r.pass).toBe(false);
    expect(r.issues).toContain('시술이 어려운 구조');
    expect(r.issues).toContain('그림이 뭉개진 부분');
  });

  it('파츠 개수 위반은 기대 범위를 함께 알려준다', () => {
    const r = verdictDetail({ ...CLEAN, metalTipCount: 4 }, BRIEF);
    expect(r.issues.some((i) => i.includes('파츠 개수 4개'))).toBe(true);
  });
});
