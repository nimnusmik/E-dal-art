import { GoogleGenAI, Type } from '@google/genai';
import type { ImagePayload } from './types';
import type { NailBrief } from './brief';
import { buildBriefPrompt } from './brief';
import { generateImage } from './provider';

/**
 * 3단계: vision 검수기 — 생성 결과를 브리프 대비 채점한다.
 *
 * 존재 이유 (파일럿 실측, ref/results/pilot-* 각 REPORT.md):
 *  - 생성 모델은 개수를 못 센다 (파츠 "2팁" 지정 → 3~5팁 렌더링, 5/10 세트에서 개수 위반)
 *  - 팔레트 이탈·매달린 파츠 같은 드리프트는 프롬프트만으로 0이 안 됨
 *  → 프롬프트는 통과율을 올리고(20%→90%), 검수는 나머지를 거른다.
 *
 * 원가 설계: 생성이 비용의 85%+ (장당 ~40~60원), 검수는 ~수 원.
 * 따라서 "2장 병렬 생성 → 채점 → 통과작 노출, 전멸 시(≈1%)에만 1장 추가"가
 * 4장 일괄 생성 대비 원가 -45%에 품질 동일.
 */

export interface NailJudgement {
  /** 베이스·구조(프렌치 깊이, 여백)가 브리프를 따르는가 */
  baseMatch: boolean;
  /** 색이 브리프 팔레트 안인가 (지정 외 색 유입 없음) */
  paletteMatch: boolean;
  /** 파츠 종류·배치가 브리프를 따르는가 (개수는 별도 카운트) */
  partsMatch: boolean;
  /** 금속·젬·진주가 올라간 팁 수 (검수기가 직접 셈) */
  metalTipCount: number;
  /** 레터링이 등장한 팁 수 */
  letteringCount: number;
  /** 물리적으로 시술 가능한가 (매달린 파츠·공중 부양·불가능 구조 없음) */
  physicsOk: boolean;
  /** AI 그림 티(뭉개진 경계, 왜곡, 잉여 사물) 없음 */
  cleanRender: boolean;
  /** 짧은 한국어 심사평 */
  notes: string;
}

export interface JudgedImage {
  image: ImagePayload;
  judgement: NailJudgement | null; // null = 검수 호출 실패 (판정 불가 → 보수적으로 탈락 취급)
  pass: boolean;
  score: number; // 0~6, 탈락작 중 최선 선택용
}

/** 브리프에서 기대 파츠 팁 수 범위를 추정 — partsLine의 명시 숫자 기반, 허용 오차 ±1 */
export function expectedMetalTips(brief: NailBrief): { min: number; max: number } {
  const line = brief.partsLine.toLowerCase();
  if (/zero metal|no metal|painted gel only[^.]*$/.test(line) && !/carries|carry/.test(line)) {
    return { min: 0, max: 0 };
  }
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5 };
  let total = 0;
  for (const m of line.matchAll(/exactly (one|two|three|four|five|\d+)/g)) {
    const n = words[m[1]] ?? Number(m[1]);
    if (Number.isFinite(n)) total += n;
  }
  if (total === 0) total = 2; // 명시 실패 시 보수적 기본값
  return { min: Math.max(0, total - 1), max: total + 1 };
}

/** 판정 로직 (코드에서 결정 — 모델은 관찰만 보고) */
export function verdict(j: NailJudgement, brief: NailBrief): { pass: boolean; score: number } {
  const { min, max } = expectedMetalTips(brief);
  const countOk = j.metalTipCount >= min && j.metalTipCount <= max;
  const letteringOk = brief.letteringWord ? j.letteringCount === 1 : j.letteringCount === 0;
  const partsOk = j.partsMatch && countOk;
  const checks = [j.baseMatch, j.paletteMatch, partsOk, letteringOk, j.physicsOk, j.cleanRender];
  const score = checks.filter(Boolean).length;
  // 즉시 탈락 3종: 물리 위반·AI 티(전문가 신뢰 = 결제 방어선) + 파츠 위반(파츠 도배가 1순위 품질 불만).
  // 나머지(베이스·팔레트·레터링)는 6점 중 5점 이상이면 통과.
  const pass = j.physicsOk && j.cleanRender && partsOk && score >= 5;
  return { pass, score };
}

/** 생성 이미지 1장을 브리프 대비 채점. 일시 오류 대비 1회 재시도, 최종 실패 시 null */
export async function judgeImage(image: ImagePayload, brief: NailBrief): Promise<NailJudgement | null> {
  const first = await judgeOnce(image, brief);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 1500));
  return judgeOnce(image, brief);
}

async function judgeOnce(image: ImagePayload, brief: NailBrief): Promise<NailJudgement | null> {
  if (process.env.GEMINI_MOCK === '1') return mockJudgement();
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        { text: judgeInstruction(brief) },
      ],
      config: { responseMimeType: 'application/json', responseSchema: JUDGE_SCHEMA },
    });
    return parseJudgement(response.text ?? '');
  } catch {
    return null;
  }
}

export function parseJudgement(text: string): NailJudgement | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const j = parsed as Record<string, unknown>;
  const bools = ['baseMatch', 'paletteMatch', 'partsMatch', 'physicsOk', 'cleanRender'] as const;
  for (const k of bools) if (typeof j[k] !== 'boolean') return null;
  if (typeof j.metalTipCount !== 'number' || typeof j.letteringCount !== 'number') return null;
  if (typeof j.notes !== 'string') return null;
  return {
    baseMatch: j.baseMatch as boolean,
    paletteMatch: j.paletteMatch as boolean,
    partsMatch: j.partsMatch as boolean,
    metalTipCount: j.metalTipCount,
    letteringCount: j.letteringCount,
    physicsOk: j.physicsOk as boolean,
    cleanRender: j.cleanRender as boolean,
    notes: j.notes,
  };
}

/**
 * 적응형 생성: batch장 병렬 생성 → 채점 → 통과작 있으면 반환,
 * 전멸 시 extra장 추가 시도. 최종적으로 (통과작 우선, 없으면 최고점) 반환.
 */
export async function generateJudged(
  inspirations: ImagePayload[],
  brief: NailBrief,
  opts: { batch?: number; extra?: number } = {},
): Promise<{ best: JudgedImage | null; attempts: JudgedImage[] }> {
  const batch = opts.batch ?? 2;
  const extra = opts.extra ?? 1;
  const prompt = buildBriefPrompt(brief);
  const attempts: JudgedImage[] = [];

  const runOne = async (): Promise<JudgedImage | null> => {
    const outcome = await generateImage(inspirations, prompt);
    if (!outcome.image) return null;
    const judgement = await judgeImage(outcome.image, brief);
    const v = judgement ? verdict(judgement, brief) : { pass: false, score: 0 };
    return { image: outcome.image, judgement, pass: v.pass, score: v.score };
  };

  const first = (await Promise.all(Array.from({ length: batch }, runOne))).filter(
    (r): r is JudgedImage => r !== null,
  );
  attempts.push(...first);

  if (!attempts.some((a) => a.pass) && extra > 0) {
    const more = (await Promise.all(Array.from({ length: extra }, runOne))).filter(
      (r): r is JudgedImage => r !== null,
    );
    attempts.push(...more);
  }

  const passed = attempts.filter((a) => a.pass);
  const pool = passed.length > 0 ? passed : attempts;
  const best = pool.length > 0 ? pool.reduce((a, b) => (b.score > a.score ? b : a)) : null;
  return { best, attempts };
}

function judgeInstruction(brief: NailBrief): string {
  return `You are a strict quality inspector at a Korean press-on nail factory.
The attached image was generated from the DESIGN BRIEF below. Inspect the image and report ONLY what you observe — verdicts are computed elsewhere.

DESIGN BRIEF:
- Base/structure: ${brief.baseLine} / ${brief.structureLine}
- Palette: ${brief.paletteLine}
- Patterns: ${brief.patternLines.join(' | ')}
- Parts rule: ${brief.partsLine}
- Lettering: ${brief.letteringWord ? `the cursive word "${brief.letteringWord}" on exactly one tip` : 'none'}

Report:
- baseMatch: base color/sheerness and french/full structure follow the brief (design contained where specified, negative space preserved).
- paletteMatch: all colors belong to the brief palette; true only if there is no clearly foreign color (small neutral accents are fine).
- partsMatch: judge ONLY whether the KIND of parts (stud / pearl / rose / gem) and their PLACEMENT (boundary line / center / etc.) match the parts rule. partsMatch MUST stay true even when there are more or fewer decorated tips than specified — quantity is reported separately in metalTipCount and judged elsewhere.
- metalTipCount: how many tips carry any metal stud, gem, or pearl. Count carefully, tip by tip.
- letteringCount: how many tips show script lettering.
- physicsOk: every part lies flat on the nail surface and everything is buildable by a human artist with gel — no hanging/dangling pieces, no floating elements, no impossible shapes.
- cleanRender: crisp edges, no melted or warped tips, no extra objects, no text overlays.
- notes: one short Korean sentence — the single most important observation.`;
}

const JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    baseMatch: { type: Type.BOOLEAN },
    paletteMatch: { type: Type.BOOLEAN },
    partsMatch: { type: Type.BOOLEAN },
    metalTipCount: { type: Type.NUMBER },
    letteringCount: { type: Type.NUMBER },
    physicsOk: { type: Type.BOOLEAN },
    cleanRender: { type: Type.BOOLEAN },
    notes: { type: Type.STRING },
  },
  required: [
    'baseMatch', 'paletteMatch', 'partsMatch', 'metalTipCount',
    'letteringCount', 'physicsOk', 'cleanRender', 'notes',
  ],
};

async function mockJudgement(): Promise<NailJudgement> {
  await new Promise((r) => setTimeout(r, 200));
  return {
    baseMatch: true,
    paletteMatch: true,
    partsMatch: true,
    metalTipCount: 1,
    letteringCount: 1,
    physicsOk: true,
    cleanRender: true,
    notes: '브리프 준수 — 통과.',
  };
}
