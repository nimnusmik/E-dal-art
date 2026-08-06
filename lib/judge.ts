import { GoogleGenAI, Type } from '@google/genai';
import type { ImagePayload } from './types';
import type { NailBrief } from './brief';
import { buildBriefPrompt } from './brief';
import { generateImage } from './provider';
import type { NailCore } from './core';
import type { PhotoTake } from './photoTake';

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
  // 0~6, 탈락작 중 최선 선택용. 이 스케일은 옛 verdict()에만 적용된다 — 체크 개수가 고정
  // 6개이기 때문. 코어 기준 점수(verdictForCore)는 코어마다 체크 개수가 달라 스케일이
  // 다르므로 score와 함께 maxScore를 반환한다. 두 스케일을 섞어 비교하지 말 것.
  score: number;
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

/* ------------------------------------------------------------------ */
/* 코어 기반 판정 (스펙 6절) — 기존 verdict은 옛 경로용으로 남겨둔다      */
/* ------------------------------------------------------------------ */

/**
 * 원본 대비 충실도 3항목 + 코어 정체성 관찰 3항목을 더한 검수 결과.
 * 관찰 3항목(raisedVolumeObserved·finishVarietyObserved·bareSurfaceShare)은 모델이 항상
 * 답해야 하는 필수 필드다 (Fix 7) — optional로 두면 "관찰 안 함"과 "관찰했는데 false/0"이
 * Boolean(undefined) === false로 뒤섞여 결측이 실제 결함과 동일하게 감점된다.
 * 채점에서 실제로 반영할지 말지는 verdictForCore가 코어별 judge 플래그로 따로 결정한다.
 */
export interface CoreJudgement extends NailJudgement {
  /** 추출 팔레트의 역할·비율이 지켜졌나 */
  paletteFidelity: boolean;
  /** fidelityAnchors 중 살아있는 개수 */
  motifFidelity: number;
  /** 선택한 코어의 정체성(여백률·질감·파츠 밀도)이 드러나나 */
  coreFidelity: boolean;
  /** 융기·조소된 젤 볼륨이 눈에 보이게 존재하는가. core.judge.requiresGelVolume이 true인
   *  코어에서만 채점에 반영된다 — 볼륨을 요구하지 않는 코어는 부재로 감점되지 않는다. */
  raisedVolumeObserved: boolean;
  /** 세트 전체에서 마감(광택/매트/크롬 등)이 2종 이상 섞여 보이는가.
   *  core.judge.expectsFinishVariety가 true인 코어에서만 채점에 반영된다. */
  finishVarietyObserved: boolean;
  /** 관찰된 미장식·맨 표면 비율(0~1). "bare"의 정의는 coreJudgeInstruction에 명시된다
   *  (베이스 색만 있고 모티프·텍스처·파츠가 전혀 없는 면적). 모든 코어에서 코어 자신의
   *  negativeSpace 상한 대비로 채점된다 — 파츠 개수만으론 "60% 맨손톱" 같은 결과를 못 잡는다. */
  bareSurfaceShare: number;
}

/**
 * 기대 파츠 팁 수 — 코어 레코드를 직접 읽는다.
 * 기존 expectedMetalTips는 partsLine 문자열을 정규식으로 파싱해 추정했는데,
 * 코어가 숫자를 직접 갖고 있으므로 그 추정이 불필요해졌다.
 */
export function coreExpectedParts(core: NailCore): { min: number; max: number } {
  return { min: core.judge.minPartsTips, max: core.judge.maxPartsTips };
}

/**
 * 코어 기준 판정. 즉시 탈락은 3종만 — 물리 위반·AI 티·파츠 개수 위반(재생성 루프가 없으므로
 * 이 세 가지 외에는 절대 pass를 false로 만들지 않는다). 충실도·관찰 항목들은 D8에 따라
 * 점수만 기록하고 탈락시키지 않는다.
 *
 * 점수 스케일은 코어마다 다르다 — 코어가 실제로 요구하는 정체성 항목만 채점에 들어가므로
 * (볼륨 요구 코어는 +1, 마감 혼합 요구 코어는 +1) 체크 총량이 코어별로 8~11 사이로 갈린다.
 * 그래서 score 단독으로는 코어 간 비교가 불가능하다 — 항상 maxScore와 함께 비율로 비교할 것.
 */
export function verdictForCore(
  j: CoreJudgement,
  core: NailCore,
  anchorCount: number,
): { pass: boolean; score: number; maxScore: number } {
  const { min, max } = coreExpectedParts(core);
  const countOk = j.metalTipCount >= min && j.metalTipCount <= max;
  const partsOk = j.partsMatch && countOk;
  const motifOk = anchorCount === 0 ? true : j.motifFidelity >= Math.ceil(anchorCount / 2);

  const checks = [
    j.baseMatch,
    j.paletteMatch,
    partsOk,
    j.physicsOk,
    j.cleanRender,
    j.paletteFidelity,
    motifOk,
    j.coreFidelity,
  ];

  // 코어가 실제로 요구하는 정체성만 점수에 반영한다 (탈락 게이트가 아니다 — D8).
  // 볼륨을 요구하지 않는 코어는 볼륨 부재로 감점하지 않고, 마감 혼합을 요구하지 않는
  // 코어는 그 관찰 자체를 채점에서 뺀다. allowGelVolume은 "허용" 의미만 가지므로 여기서는
  // 쓰지 않는다 — 채점 여부는 requiresGelVolume(="요구")로만 결정한다.
  if (core.judge.requiresGelVolume) {
    checks.push(j.raisedVolumeObserved);
  }
  if (core.judge.expectsFinishVariety) {
    checks.push(j.finishVarietyObserved);
  }
  // 맨 표면 비율은 모든 코어에서 채점한다 — 코어 자신의 negativeSpace 상한 대비로 항상
  // 의미 있는 비교이기 때문. 예전에는 minNegativeSpace<0.5인 코어만 채점해서, 상한이
  // 0.7인 코케트 같은 코어의 "95% 맨손톱" 세트가 이 체크 없이 만점을 받는 사각지대가 있었다.
  const maxBare = core.negativeSpace[1] + BARE_SURFACE_TOLERANCE;
  checks.push(j.bareSurfaceShare <= maxBare);

  const score = checks.filter(Boolean).length;

  const pass = j.physicsOk && j.cleanRender && partsOk;
  return { pass, score, maxScore: checks.length };
}

/**
 * 관찰치의 자연스러운 흔들림을 흡수하는 여유치.
 * 임시값 — 실측 파일럿 데이터가 없어 임의로 잡았다. 실제 파일럿 결과가 쌓이면
 * (bareSurfaceShare 관찰의 모델 재현성 데이터로) 재보정해야 한다.
 */
const BARE_SURFACE_TOLERANCE = 0.15;

/**
 * 코어 기반 검수 지시문 — 코어가 실제로 요구하는 것만 관찰하게 한다 (게이트 판정은 코드가 함).
 * source photo(s) + generated image를 모두 첨부하므로, 어느 첨부가 무엇인지 반드시 못박고
 * 원본 팔레트·anchor 목록을 텍스트로 함께 준다 — 그렇지 않으면 paletteFidelity·motifFidelity가
 * 비교 대상 없이 답해야 하는 확인 불가능한 질문이 된다 (Fix 1).
 */
export function coreJudgeInstruction(core: NailCore, photoTake: PhotoTake): string {
  const paletteLines = photoTake.palette
    .map((p) => `- ${p.nameEn} — role: ${p.role}, surface share: ~${Math.round(p.ratio * 100)}%`)
    .join('\n');
  const anchorLines =
    photoTake.fidelityAnchors.length > 0
      ? photoTake.fidelityAnchors.map((a, i) => `${i + 1}. ${a}`).join('\n')
      : '(none listed — treat motifFidelity as not applicable and report 0)';

  return `You are a strict quality inspector at a Korean press-on nail factory.

You are given two kinds of attached images, always in this order:
1. SOURCE INSPIRATION PHOTO(S) — the original photo(s) the client brought in. There may be one or more of these.
2. GENERATED TIP BOARD — the LAST attached image only. This is the finished flat-lay tip set that was generated for the "${core.id}" nail-art core, and it is the ONLY image you are grading.
Do not confuse the two: judge the GENERATED TIP BOARD against the CORE RULES and against the SOURCE PALETTE / SOURCE FIDELITY ANCHORS below, which describe the source inspiration photo(s). Report ONLY what you observe — verdicts are computed elsewhere.

CORE RULES:
- Base/structure: ${core.baseLine} / ${core.structure}
- Finish: ${core.finishMix}
- Parts physics: ${core.partsPhysics}
- Allowed materials: ${core.allowedMaterials.join(', ')}
- Forbidden: ${core.forbidden.join(' | ')}

SOURCE PALETTE (extracted from the source inspiration photo(s) — this is what paletteFidelity checks against):
${paletteLines}

SOURCE FIDELITY ANCHORS (must-survive elements from the source inspiration photo(s) — this is what motifFidelity counts):
${anchorLines}

Report:
- baseMatch: base color/sheerness and structure follow the core rules (design contained where specified, negative space preserved as intended).
- paletteMatch: all colors in the GENERATED TIP BOARD belong to the intended palette; true only if there is no clearly foreign color (small neutral accents are fine).
- partsMatch: judge ONLY whether the KIND of parts and their PLACEMENT match the core rules. partsMatch MUST stay true even when there are more or fewer decorated tips than the budget — quantity is reported separately in metalTipCount and judged elsewhere.
- metalTipCount: how many tips carry any metal stud, gem, pearl, or built-up part. Count carefully, tip by tip.
- letteringCount: how many tips show script lettering.
- physicsOk: every part lies flat or is built up from the nail surface and everything is buildable by a human artist with gel — no hanging/dangling pieces, no floating elements, no impossible shapes.
- cleanRender: crisp edges, no melted or warped tips, no extra objects, no text overlays.
- paletteFidelity: true only if the GENERATED TIP BOARD's colors match the SOURCE PALETTE above in both which colors are used AND roughly how much surface each one covers — matching hues with very different proportions is NOT a fidelity match.
- motifFidelity: count how many of the SOURCE FIDELITY ANCHORS listed above are still recognizable in the GENERATED TIP BOARD. Report the count (an integer), not a boolean.
- coreFidelity: the core's own identity (negative space ratio, texture, part density) reads clearly in the GENERATED TIP BOARD.
- raisedVolumeObserved: true only if sculpted or raised gel volume is clearly visible standing up off the nail surface (not just flat paint).
- finishVarietyObserved: true only if more than one distinct surface finish (glossy / matte / chrome / velvet / textured) is visible across the set, not the same finish repeated on every tip.
- bareSurfaceShare: your best estimate, as a number between 0 and 1, of the fraction of total nail surface across the set that is "bare". Bare means: base color only, with no motif, no texture, and no part on that area — a tip that is fully covered in a single flat color but has no motif/texture/part on it still counts as bare.
- notes: one short Korean sentence — the single most important observation.`;
}

const CORE_JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    baseMatch: { type: Type.BOOLEAN },
    paletteMatch: { type: Type.BOOLEAN },
    partsMatch: { type: Type.BOOLEAN },
    metalTipCount: { type: Type.NUMBER },
    letteringCount: { type: Type.NUMBER },
    physicsOk: { type: Type.BOOLEAN },
    cleanRender: { type: Type.BOOLEAN },
    paletteFidelity: { type: Type.BOOLEAN },
    motifFidelity: { type: Type.NUMBER },
    coreFidelity: { type: Type.BOOLEAN },
    raisedVolumeObserved: { type: Type.BOOLEAN },
    finishVarietyObserved: { type: Type.BOOLEAN },
    bareSurfaceShare: { type: Type.NUMBER },
    notes: { type: Type.STRING },
  },
  required: [
    'baseMatch', 'paletteMatch', 'partsMatch', 'metalTipCount',
    'letteringCount', 'physicsOk', 'cleanRender', 'paletteFidelity',
    'motifFidelity', 'coreFidelity', 'raisedVolumeObserved',
    'finishVarietyObserved', 'bareSurfaceShare', 'notes',
  ],
};

/**
 * 생성 이미지 1장을 코어 기준으로 채점. source photo(s)도 함께 첨부해야 paletteFidelity·
 * motifFidelity가 답변 가능한 질문이 된다 (Fix 1) — 생성 이미지 1장만 보내면 모델이 비교할
 * "원본"이 없어 두 필드가 사실상 임의값이 된다.
 * 일시 오류 대비 1회 재시도, 최종 실패 시 null.
 */
export async function judgeImageForCore(
  generatedImage: ImagePayload,
  sourcePhotos: ImagePayload[],
  core: NailCore,
  photoTake: PhotoTake,
): Promise<CoreJudgement | null> {
  const first = await judgeOnceForCore(generatedImage, sourcePhotos, core, photoTake);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 1500));
  return judgeOnceForCore(generatedImage, sourcePhotos, core, photoTake);
}

async function judgeOnceForCore(
  generatedImage: ImagePayload,
  sourcePhotos: ImagePayload[],
  core: NailCore,
  photoTake: PhotoTake,
): Promise<CoreJudgement | null> {
  if (process.env.GEMINI_MOCK === '1') return mockCoreJudgement();
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [
        // 순서가 지시문의 "첫 N장 = 원본, 마지막 1장 = 생성 이미지" 서술과 일치해야 한다.
        ...sourcePhotos.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
        { inlineData: { data: generatedImage.data, mimeType: generatedImage.mimeType } },
        { text: coreJudgeInstruction(core, photoTake) },
      ],
      config: { responseMimeType: 'application/json', responseSchema: CORE_JUDGE_SCHEMA },
    });
    return parseCoreJudgement(response.text ?? '');
  } catch {
    return null;
  }
}

/**
 * 코어 기반 검수 응답 파싱 — 기존 parseJudgement와 별도 경로.
 * 신규 관찰 3필드(raisedVolumeObserved·finishVarietyObserved·bareSurfaceShare)는 CoreJudgement에서
 * required이므로(Fix 7), 여기서도 타입이 안 맞거나 없으면 전체를 null로 거부한다 — optional
 * 취급하면 "관찰 안 함"과 "false/0으로 관찰함"이 구분 안 되어 결측이 실제 결함처럼 감점된다.
 */
export function parseCoreJudgement(text: string): CoreJudgement | null {
  const base = parseJudgement(text);
  if (!base) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const j = parsed as Record<string, unknown>;
  if (typeof j.paletteFidelity !== 'boolean') return null;
  if (typeof j.motifFidelity !== 'number') return null;
  if (typeof j.coreFidelity !== 'boolean') return null;
  if (typeof j.raisedVolumeObserved !== 'boolean') return null;
  if (typeof j.finishVarietyObserved !== 'boolean') return null;
  if (typeof j.bareSurfaceShare !== 'number') return null;
  return {
    ...base,
    paletteFidelity: j.paletteFidelity,
    motifFidelity: j.motifFidelity,
    coreFidelity: j.coreFidelity,
    raisedVolumeObserved: j.raisedVolumeObserved,
    finishVarietyObserved: j.finishVarietyObserved,
    bareSurfaceShare: j.bareSurfaceShare,
  };
}

async function mockCoreJudgement(): Promise<CoreJudgement> {
  await new Promise((r) => setTimeout(r, 200));
  return {
    baseMatch: true,
    paletteMatch: true,
    partsMatch: true,
    metalTipCount: 1,
    letteringCount: 1,
    physicsOk: true,
    cleanRender: true,
    notes: '코어 규칙 준수 — 통과.',
    paletteFidelity: true,
    motifFidelity: 2,
    coreFidelity: true,
    raisedVolumeObserved: true,
    finishVarietyObserved: true,
    bareSurfaceShare: 0.1,
  };
}
