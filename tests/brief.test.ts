import { describe, it, expect, afterEach } from 'vitest';
import {
  parseBrief,
  buildBriefPrompt,
  PARTS_PHYSICS,
  ZERO_PARTS_LINE,
  applyOptions,
  applyPlan,
  parseVariantPlan,
  fallbackPlans,
  parsePlans,
  planVariants,
} from '@/lib/brief';
import type { NailBrief } from '@/lib/brief';
import type { VariantPlan } from '@/lib/types';

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

describe('buildBriefPrompt — 길이 규칙 (계약서 P3)', () => {
  it('short: 디자인 존 20-30% 축소 + 마이크로 스케일 라인을 포함한다', () => {
    const prompt = buildBriefPrompt({ ...VALID, length: 'short' });
    expect(prompt).toContain('20-30%');
    expect(prompt).toContain('micro dots');
  });

  it('medium: 기존 스펙(30-45%) 라인을 포함한다', () => {
    expect(buildBriefPrompt(VALID)).toContain('30-45%');
  });

  it('long: 딥프렌치·레터링·센터피스 허용 라인을 포함한다', () => {
    const prompt = buildBriefPrompt({ ...VALID, length: 'long' });
    expect(prompt).toContain('deep-french');
    expect(prompt).toContain('centerpiece');
  });

  it('모든 길이에서 금지 어휘(charm/anchor)가 없다', () => {
    for (const length of ['short', 'medium', 'long'] as const) {
      const prompt = buildBriefPrompt({ ...VALID, length, letteringWord: null }).toLowerCase();
      expect(prompt).not.toMatch(/\bcharms?\b/);
      expect(prompt).not.toMatch(/\banchor\b/);
    }
  });
});

describe('applyOptions', () => {
  const OPTS = { shape: 'square', length: 'long', partsIntensity: 'auto' } as const;

  it('쉐입·길이를 주문값으로 덮어쓴다 (auto: partsLine 그대로)', () => {
    const out = applyOptions(VALID, OPTS);
    expect(out.shape).toBe('square');
    expect(out.length).toBe('long');
    expect(out.partsLine).toBe(VALID.partsLine);
  });

  it('순수 함수 — 원본 브리프를 변형하지 않는다', () => {
    const snapshot = JSON.parse(JSON.stringify(VALID));
    applyOptions(VALID, { ...OPTS, partsIntensity: 'none' });
    expect(VALID).toEqual(snapshot);
  });

  it('none: 파츠 제로 문장으로 교체한다', () => {
    const out = applyOptions(VALID, { ...OPTS, partsIntensity: 'none' });
    expect(out.partsLine).toBe(ZERO_PARTS_LINE);
  });

  it('point: 기존 파츠 종류(pearl)를 유지하며 포인트 1개 + 배제 문장으로 축소한다', () => {
    const out = applyOptions(VALID, { ...OPTS, partsIntensity: 'point' });
    expect(out.partsLine).toContain('Exactly one tip');
    expect(out.partsLine).toContain('pearl');
    expect(out.partsLine).toContain('Every other tip is painted gel only');
  });

  it('point: stud 계열 partsLine이면 stud를 유지한다', () => {
    const brief = {
      ...VALID,
      partsLine:
        'Exactly three tips each carry a flat silver metal stud shaped as a star. Every other tip is painted gel only — no metal, no gems, no pearls.',
    };
    const out = applyOptions(brief, { ...OPTS, partsIntensity: 'point' });
    expect(out.partsLine).toContain('metal stud');
    expect(out.partsLine).toContain('Exactly one tip');
  });

  it('point: 파츠 종류를 알 수 없으면 pearl 1개 기본', () => {
    const brief = { ...VALID, partsLine: ZERO_PARTS_LINE };
    const out = applyOptions(brief, { ...OPTS, partsIntensity: 'point' });
    expect(out.partsLine).toContain('pearl');
  });

  it('rich: 분석 결과에 파츠가 있으면 그대로 유지한다', () => {
    const out = applyOptions(VALID, { ...OPTS, partsIntensity: 'rich' });
    expect(out.partsLine).toBe(VALID.partsLine);
  });

  it('rich: 원본이 파츠 제로면 상향한다 (명시 개수 + 배제 문장 유지)', () => {
    const brief = { ...VALID, partsLine: ZERO_PARTS_LINE };
    const out = applyOptions(brief, { ...OPTS, partsIntensity: 'rich' });
    expect(out.partsLine).toMatch(/Exactly/);
    expect(out.partsLine).toContain('Every other tip is painted gel only');
  });
});

describe('applyPlan', () => {
  const PLAN: VariantPlan = {
    id: 'v2',
    title: '컬러 반전',
    patternLines: ['Inverted dots.'],
    partsLine: ZERO_PARTS_LINE,
    letteringWord: null,
  };

  it('플랜의 패턴·파츠·레터링으로 브리프를 대체한다', () => {
    const out = applyPlan(VALID, PLAN);
    expect(out.patternLines).toEqual(['Inverted dots.']);
    expect(out.partsLine).toBe(ZERO_PARTS_LINE);
    expect(out.letteringWord).toBeNull();
    expect(out.paletteLine).toBe(VALID.paletteLine); // paletteLine 없으면 베이스 유지
  });

  it('paletteLine이 있으면 덮어쓴다', () => {
    const out = applyPlan(VALID, { ...PLAN, paletteLine: 'lilac + mint on milky white' });
    expect(out.paletteLine).toBe('lilac + mint on milky white');
  });
});

describe('parseVariantPlan', () => {
  const RAW = {
    id: 'v1',
    title: '오리지널',
    patternLines: ['dots'],
    partsLine: ZERO_PARTS_LINE,
    letteringWord: null,
  };

  it('유효한 플랜을 통과시킨다', () => {
    expect(parseVariantPlan(RAW)).toEqual(RAW);
  });

  it('letteringWord 빈 문자열은 null로 정규화한다', () => {
    expect(parseVariantPlan({ ...RAW, letteringWord: '' })?.letteringWord).toBeNull();
  });

  it('patternLines가 비면 null', () => {
    expect(parseVariantPlan({ ...RAW, patternLines: [] })).toBeNull();
  });

  it('partsLine이 없으면 null', () => {
    const { partsLine: _omit, ...rest } = RAW;
    expect(parseVariantPlan(rest)).toBeNull();
  });

  it('객체가 아니면 null', () => {
    expect(parseVariantPlan('v1')).toBeNull();
  });
});

describe('fallbackPlans — 결정적 폴백 (LLM 없이 동작)', () => {
  it('항상 5개, id는 v1~v5', () => {
    const plans = fallbackPlans(VALID);
    expect(plans).toHaveLength(5);
    expect(plans.map((p) => p.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('v1은 원본 그대로, v4는 파츠 제로', () => {
    const plans = fallbackPlans(VALID);
    expect(plans[0].patternLines).toEqual(VALID.patternLines);
    expect(plans[0].partsLine).toBe(VALID.partsLine);
    expect(plans[3].partsLine).toBe(ZERO_PARTS_LINE);
  });

  it('레터링은 최대 2개 플랜에만 (원본 유지분 1개)', () => {
    const withLettering = fallbackPlans(VALID).filter((p) => p.letteringWord !== null);
    expect(withLettering.length).toBeLessThanOrEqual(2);
  });

  it('모든 플랜이 어휘 규칙을 지키고 타입가드를 통과한다', () => {
    for (const plan of fallbackPlans(VALID)) {
      expect(parseVariantPlan(plan)).not.toBeNull();
      const text = [plan.title, plan.partsLine, ...plan.patternLines].join(' ').toLowerCase();
      expect(text).not.toMatch(/\bcharms?\b/);
      expect(text).not.toMatch(/\banchor\b/);
    }
  });
});

describe('parsePlans', () => {
  const RAW_PLANS = fallbackPlans(VALID).map((p) => ({ ...p, paletteLine: '' }));

  it('유효한 5종을 파싱하고 id를 v1~v5로 정규화한다', () => {
    const plans = parsePlans(JSON.stringify({ plans: RAW_PLANS }));
    expect(plans).toHaveLength(5);
    expect(plans?.map((p) => p.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
  });

  it('5개가 아니면 null', () => {
    expect(parsePlans(JSON.stringify({ plans: RAW_PLANS.slice(0, 4) }))).toBeNull();
  });

  it('금지 어휘(charm)가 섞이면 null — 폴백 유도', () => {
    const dirty = RAW_PLANS.map((p, i) =>
      i === 2 ? { ...p, patternLines: ['a gold charm on one tip'] } : p,
    );
    expect(parsePlans(JSON.stringify({ plans: dirty }))).toBeNull();
  });

  it('레터링이 3개 이상이면 코드에서 2개까지만 남긴다', () => {
    const lettered = RAW_PLANS.map((p) => ({ ...p, letteringWord: 'Sugar' }));
    const plans = parsePlans(JSON.stringify({ plans: lettered }));
    expect(plans?.filter((p) => p.letteringWord !== null)).toHaveLength(2);
  });

  it('JSON이 아니면 null', () => {
    expect(parsePlans('oops')).toBeNull();
  });
});

describe('planVariants — 폴백·목 동작 (실 API 호출 없음)', () => {
  const originalMock = process.env.GEMINI_MOCK;
  afterEach(() => {
    if (originalMock === undefined) delete process.env.GEMINI_MOCK;
    else process.env.GEMINI_MOCK = originalMock;
  });

  it('GEMINI_MOCK=1이면 결정적 폴백 5종을 반환한다', async () => {
    process.env.GEMINI_MOCK = '1';
    const plans = await planVariants(VALID);
    expect(plans).toEqual(fallbackPlans(VALID));
  });
});
