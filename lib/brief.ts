import { GoogleGenAI, Type } from '@google/genai';
import type { ImagePayload, NailLength, NailShape, PartsIntensity, VariantPlan } from './types';

/**
 * 1단계 분석 v2 — 영감 사진 → "구조 문법 브리프".
 *
 * 기존 analyze.ts(색·기법 나열)와 달리, 생성 프롬프트에 그대로 꽂히는
 * 완성형 브리프 문장을 뽑는다. 검증 근거: ref/results/pilot-interpret/REPORT.md
 * (수동 브리프로 원본 충실도 90~95% 확인 — 이 모듈은 그 수동 작성을 자동화).
 *
 * 프롬프트 작성 문법 (2026-08-02~03 파일럿 3회에서 확립, ref/PARTS_ANALYSIS.md):
 *  1. 다의어 금지 — 모든 명사는 "그림으로 그려지면?"을 기준으로 선택.
 *     charm(→펜던트 고리)·anchor(→닻) 금지, 파츠는 flat metal stud/pearl/3D rose로 지칭.
 *  2. 부정문은 뚫린다 — 물리·제약은 긍정문으로 서술.
 *  3. 파츠는 팁 단위로 명세하고, 지정 외 팁은 "painted gel only"로 못박는다.
 *  4. 레터링은 4~6자 흔한 단어, "written once, on one tip only".
 */

export interface NailBrief {
  /** 팁 쉐입 (원본 사진에서 관찰) */
  shape: 'almond' | 'round' | 'square' | 'oval' | 'stiletto' | 'coffin';
  length: 'short' | 'medium' | 'long';
  /** 베이스 서술 한 줄 (예: sheer milky nude, glass-gloss gel finish) */
  baseLine: string;
  /** 구조 서술 — 딥프렌치인지, 풀컬러 믹스인지, 여백 규칙 포함 */
  structureLine: string;
  /** 팔레트 서술 — 색 이름 + 배합 관계 (예: baby blue + chocolate brown on milky nude) */
  paletteLine: string;
  /** 팁별 패턴 변주 서술 2~5줄 */
  patternLines: string[];
  /** 젤 볼륨 기법 (물방울·톤온톤 양각 등). 없으면 빈 문자열 */
  textureLine: string;
  /** 파츠 규칙 — 팁 단위 명세 + 지정 외 팁 배제 문장까지 포함된 완성 문장 */
  partsLine: string;
  /** 필기체 레터링 단어 (4~6자, 세트 무드 연동). 없으면 null */
  letteringWord: string | null;
  /** 무드 한 줄 (영문, 생성 프롬프트용) */
  moodLine: string;
  /** 한국어 무드 키워드 2~3개 (상품 텍스트용) */
  keywords: string[];
  /** 지배 색상 3개 #RRGGBB (상품 텍스트용) */
  colors: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  /** 시술 조정 메모 (한국어) */
  feasibilityNotes: string;
}

/** 분석 실패 시 null — 일시 오류(쿼터 등) 대비 1회 재시도. 호출부는 기존 analyze.ts 경로로 폴백 가능 */
export async function analyzeToBrief(images: ImagePayload[]): Promise<NailBrief | null> {
  const first = await analyzeOnce(images);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 2000));
  return analyzeOnce(images);
}

async function analyzeOnce(images: ImagePayload[]): Promise<NailBrief | null> {
  if (process.env.GEMINI_MOCK === '1') return mockBrief();
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [
        ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
        { text: BRIEF_INSTRUCTION },
      ],
      config: { responseMimeType: 'application/json', responseSchema: BRIEF_SCHEMA },
    });
    return parseBrief(response.text ?? '');
  } catch {
    return null;
  }
}

/** JSON 텍스트 → NailBrief. 스키마 위반 시 null */
export function parseBrief(text: string): NailBrief | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const b = parsed as Record<string, unknown>;
  const isStr = (v: unknown): v is string => typeof v === 'string';
  const isStrArr = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((s) => typeof s === 'string');
  const SHAPES = new Set(['almond', 'round', 'square', 'oval', 'stiletto', 'coffin']);
  const LENGTHS = new Set(['short', 'medium', 'long']);
  const DIFFS = new Set(['easy', 'medium', 'hard']);
  if (!isStr(b.shape) || !SHAPES.has(b.shape)) return null;
  if (!isStr(b.length) || !LENGTHS.has(b.length)) return null;
  for (const k of ['baseLine', 'structureLine', 'paletteLine', 'textureLine', 'partsLine', 'moodLine', 'feasibilityNotes']) {
    if (!isStr(b[k])) return null;
  }
  if (!isStrArr(b.patternLines) || b.patternLines.length === 0) return null;
  if (!isStrArr(b.keywords) || b.keywords.length === 0) return null;
  if (!isStrArr(b.colors) || b.colors.length === 0) return null;
  if (!isStr(b.difficulty) || !DIFFS.has(b.difficulty)) return null;
  const letteringWord = isStr(b.letteringWord) && b.letteringWord.length > 0 ? b.letteringWord : null;
  return {
    shape: b.shape as NailBrief['shape'],
    length: b.length as NailBrief['length'],
    baseLine: b.baseLine as string,
    structureLine: b.structureLine as string,
    paletteLine: b.paletteLine as string,
    patternLines: b.patternLines,
    textureLine: b.textureLine as string,
    partsLine: b.partsLine as string,
    letteringWord,
    moodLine: b.moodLine as string,
    keywords: b.keywords,
    colors: b.colors,
    difficulty: b.difficulty as NailBrief['difficulty'],
    feasibilityNotes: b.feasibilityNotes as string,
  };
}

/** 파츠 제로 문장 — none 오버라이드·폴백 플랜 공용 (judge.expectedMetalTips가 0으로 인식하는 형태) */
export const ZERO_PARTS_LINE =
  'Every tip is painted gel only — no metal, no gems, no pearls, no 3D parts.';

/** rich 오버라이드에서 원본이 파츠 제로일 때 쓰는 상향 기본값 (파츠 예산: 스터드 3~6, STYLE_ANALYSIS E절) */
const RICH_DEFAULT_PARTS_LINE =
  'Exactly one tip carries a single small pearl and exactly two tips each carry a single flat silver metal stud, every part lying flat on the nail surface. Every other tip is painted gel only — no metal, no gems, no pearls.';

/** partsLine이 파츠 제로 서술인지 판별 (expectedMetalTips와 동일 기준) */
function isZeroParts(partsLine: string): boolean {
  const line = partsLine.toLowerCase();
  return /painted gel only/.test(line) && !/carries|carry/.test(line);
}

/** point 강도용 — 기존 partsLine의 파츠 종류를 유지하되 포인트 1개로 축소. 종류 불명이면 pearl */
const POINT_PART_KINDS: Array<{ pattern: RegExp; noun: string }> = [
  { pattern: /pearl/i, noun: 'a single small pearl' },
  { pattern: /rose/i, noun: 'a single small 3D acrylic rose' },
  { pattern: /microbead|bead/i, noun: 'a single tiny silver microbead' },
  { pattern: /stud|metal/i, noun: 'a single flat silver metal stud' },
  { pattern: /gem/i, noun: 'a single small flat gem' },
  { pattern: /button/i, noun: 'a single flat button-shaped part' },
];

function pointPartsLine(partsLine: string): string {
  // 배제 문장("Every other tip ... no pearls")의 명사에 오탐하지 않도록 파츠 명세 앞부분만 검사
  const head = partsLine.split(/every other tip/i)[0];
  const kind =
    POINT_PART_KINDS.find((k) => k.pattern.test(head))?.noun ?? 'a single small pearl';
  return `Exactly one tip carries ${kind} as its only accent, lying flat on the nail surface. Every other tip is painted gel only — no metal, no gems, no pearls.`;
}

/**
 * 손님 주문 옵션 적용 — 쉐입·길이 덮어쓰기 + partsIntensity별 partsLine 오버라이드.
 * 순수 함수 (원본 브리프 불변). 규칙: docs/api-variants-contract.md "길이·파츠 규칙".
 */
export function applyOptions(
  brief: NailBrief,
  opts: { shape: NailShape; length: NailLength; partsIntensity: PartsIntensity },
): NailBrief {
  const next: NailBrief = { ...brief, shape: opts.shape, length: opts.length };
  switch (opts.partsIntensity) {
    case 'none':
      next.partsLine = ZERO_PARTS_LINE;
      break;
    case 'point':
      next.partsLine = pointPartsLine(brief.partsLine);
      break;
    case 'rich':
      // 분석 결과 유지 — 단, 원본이 파츠 제로면 상향 허용
      if (isZeroParts(brief.partsLine)) next.partsLine = RICH_DEFAULT_PARTS_LINE;
      break;
    case 'auto':
      break; // 분석 결과 그대로
  }
  return next;
}

/** 플랜을 베이스 브리프에 병합 — 순수 함수 (variant 라우트에서 사용) */
export function applyPlan(brief: NailBrief, plan: VariantPlan): NailBrief {
  return {
    ...brief,
    patternLines: plan.patternLines,
    partsLine: plan.partsLine,
    letteringWord: plan.letteringWord,
    paletteLine: plan.paletteLine ?? brief.paletteLine,
  };
}

/**
 * 파츠 물리 법칙 — 모든 생성 프롬프트 공통 첨부.
 * "charm" 어휘 금지 + 긍정문 서술 (검증: 고리 3/3 → 0/3, PARTS_ANALYSIS 5-1절)
 */
export const PARTS_PHYSICS = `- METAL PART PHYSICS: every metal part is a FLAT embossed metal stud lying flush ON the nail surface, sealed under a layer of clear gel — glued down like a sticker with slight thickness. Each stud is a SOLID CAST shape with a clean closed outline, exactly the motif silhouette and nothing more. The stud stays fully inside the nail's outline.`;

/**
 * 길이별 스케일 규칙 — 긍정문으로 "무엇이 들어가는지"만 서술 (부정문은 뚫린다).
 * 수치 근거: ref/trendy/STYLE_ANALYSIS.md E절 (프렌치 깊이 30~45%, 도트 스케일).
 */
const LENGTH_RULES: Record<NailBrief['length'], string> = {
  short:
    '- Length rule (short tips): the design zone shrinks to 20-30% of each nail — keep every motif micro-scale: micro dots (0.5-1mm) and thin 0.5mm lines only, each element flat-painted and fully contained inside that compact zone.',
  medium:
    '- Length rule (medium tips): the design zone covers 30-45% of each nail — standard deep-french depth.',
  long:
    '- Length rule (long tips): the design zone may run deep — deep-french coverage, script lettering, and a single centerpiece part on one hero tip are all welcome.',
};

/** 브리프 → 팁셋(플랫레이) 생성 프롬프트. pilot-interpret에서 검증된 형태 그대로. */
export function buildBriefPrompt(brief: NailBrief): string {
  const letteringLine = brief.letteringWord
    ? `- Exactly one tip carries a single short cursive black script word "${brief.letteringWord}" — written once, on one tip only.`
    : '';
  const textureLine = brief.textureLine ? `- ${brief.textureLine}` : '';
  return `You are a top Korean nail artist presenting a design set inspired by the attached reference photo.
Create ONE photorealistic top-down flat-lay photo of a press-on nail tip sample board: individual ${brief.length} ${brief.shape} nail tips laid out in neat rows on a plain light-grey background, soft even studio lighting.

DESIGN BRIEF — follow every line exactly:
- ${brief.baseLine}
- ${brief.structureLine}
- Palette: ${brief.paletteLine}
${LENGTH_RULES[brief.length]}
${brief.patternLines.map((l) => `- ${l}`).join('\n')}
${textureLine}
- PARTS RULE: ${brief.partsLine}
${letteringLine}
${PARTS_PHYSICS}
- Mood: ${brief.moodLine}
- Every element is hand-paintable by a human artist with gel: slight hand-made micro-variations, natural gel edge highlights, clean crisp edges.
- The tips are the only subject: plain background, clean composition, no text overlays, nothing else in frame.`
    .replace(/\n{3,}/g, '\n\n');
}

const BRIEF_INSTRUCTION = `You are a veteran Korean nail artist AND a prompt engineer for an image generation model.
Study the attached inspiration photo(s) and write a DESIGN BRIEF that lets an image model recreate a press-on nail SET faithful to this photo's character. You are not describing the photo — you are writing generation instructions.

## Vocabulary for parts (use ONLY these nouns)
- painted elements: dots, thin stripes, gingham check, lace-trim line, swirl doodles, script lettering, hand-painted flowers/fruits, animal print (zebra/croc)
- metal: "tiny silver microbeads", "flat gold/silver metal stud shaped as <motif>" (NEVER the word "charm" — it makes the model draw a hanging pendant; NEVER "anchor" — it draws ⚓)
- other parts: "small pearl", "small 3D acrylic rose", "flat button-shaped part"
- gel volume techniques: "clear gel water droplets", "tone-on-tone raised gel <motif> (same color as base, embossed)", "sculpted gel waves"

## Parts placement structures (pick what matches the photo)
- one accent part on one tip, all other tips painted-only
- microbeads arranged in a precise shape outline (cross/heart/V) on 1-2 tips, like pixels
- dots or beads tracing along the french boundary line
- one bead/pearl sitting exactly ON the boundary line like a belt buckle
- one centerpiece (3D rose / flat stud) at the center of one hero tip
- zero parts (purely hand-painted set)

## Writing rules (violations make the generation fail)
1. partsLine MUST use explicit counts ("Exactly one tip...", "Exactly three tips...") AND end by excluding the rest, e.g. "Exactly one tip carries a single small pearl on its french boundary line. Every other tip is painted gel only — no metal, no gems, no pearls." Never write vague quantifiers like "select tips" or "some tips". First COUNT how many tips in the photo actually carry parts and mirror that density: a parts-heavy photo gets a high explicit count, a minimal photo gets 1-2, a painted-only photo gets the zero-parts sentence.
2. Use positive phrasing everywhere. Say what IS, precisely, instead of listing what to avoid.
3. Every noun you write will be drawn literally. Choose nouns whose most common image is what you want.
4. If the photo's decorations are physically impossible or dangling, translate them into flat stud / painted equivalents and note it in feasibilityNotes.
5. structureLine: state whether tips are deep-French on sheer nude (design only in the tip zone, nude zone stays empty) or full-color / mixed, matching the photo.
6. patternLines: 2-5 lines describing the per-tip variations like a human artist plans a set (vary scale, density, figure/ground swap, boundary shape).
7. letteringWord: only if the photo mood suits script lettering — a common 4-6 letter word derived from the concept (e.g. Sugar, Honey, Cherie, Bonbon). Otherwise empty string.
8. moodLine: one short English mood sentence. keywords: 2-3 short Korean mood words. colors: 3 dominant #RRGGBB. feasibilityNotes: one short Korean sentence for the salon artist.`;

const BRIEF_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    shape: { type: Type.STRING, enum: ['almond', 'round', 'square', 'oval', 'stiletto', 'coffin'] },
    length: { type: Type.STRING, enum: ['short', 'medium', 'long'] },
    baseLine: { type: Type.STRING },
    structureLine: { type: Type.STRING },
    paletteLine: { type: Type.STRING },
    patternLines: { type: Type.ARRAY, items: { type: Type.STRING } },
    textureLine: { type: Type.STRING },
    partsLine: { type: Type.STRING },
    letteringWord: { type: Type.STRING },
    moodLine: { type: Type.STRING },
    keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
    colors: { type: Type.ARRAY, items: { type: Type.STRING } },
    difficulty: { type: Type.STRING, enum: ['easy', 'medium', 'hard'] },
    feasibilityNotes: { type: Type.STRING },
  },
  required: [
    'shape', 'length', 'baseLine', 'structureLine', 'paletteLine', 'patternLines',
    'textureLine', 'partsLine', 'letteringWord', 'moodLine', 'keywords', 'colors',
    'difficulty', 'feasibilityNotes',
  ],
};

/** 로컬 개발용 목 브리프 (GEMINI_MOCK=1) */
async function mockBrief(): Promise<NailBrief> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    shape: 'almond',
    length: 'medium',
    baseLine: 'Base of every tip: sheer milky nude with a glass-like high-gloss gel finish.',
    structureLine: 'Deep French tips — the design lives only inside the tip area, nude zone above stays empty and glossy.',
    paletteLine: 'baby pink + baby blue on milky white',
    patternLines: ['Small polka dots inside the tip area, varied in scale and density per tip.'],
    textureLine: '',
    partsLine: 'Exactly one tip carries a single small pearl on its french boundary line. Every other tip is painted gel only — no metal, no gems, no pearls.',
    letteringWord: 'Sugar',
    moodLine: 'kawaii coquette Y2K — sweet, airy, wearable.',
    keywords: ['코케트', '파스텔'],
    colors: ['#f5c8d7', '#b8dde8', '#efe0dc'],
    difficulty: 'medium',
    feasibilityNotes: '도트는 도트봉으로 시술 가능, 진주는 1개만 경계선 위에 고정하세요.',
  };
}

/* ------------------------------------------------------------------ */
/* 5종 변주 플랜 (docs/api-variants-contract.md)                        */
/* ------------------------------------------------------------------ */

/** 금지 어휘 검사 — charm(펜던트 고리)·anchor(닻) 단어 함정 (PARTS_ANALYSIS 5-1절) */
function hasBannedVocab(text: string): boolean {
  return /\bcharms?\b|\banchors?\b/i.test(text);
}

/** unknown → VariantPlan 런타임 타입가드. 위반 시 null (letteringWord 빈 문자열은 null 정규화) */
export function parseVariantPlan(value: unknown): VariantPlan | null {
  if (typeof value !== 'object' || value === null) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.id !== 'string' || p.id.length === 0) return null;
  if (typeof p.title !== 'string' || p.title.length === 0) return null;
  if (!Array.isArray(p.patternLines) || p.patternLines.length === 0) return null;
  if (!p.patternLines.every((l) => typeof l === 'string' && l.length > 0)) return null;
  if (typeof p.partsLine !== 'string' || p.partsLine.length === 0) return null;
  if (p.letteringWord !== null && p.letteringWord !== undefined && typeof p.letteringWord !== 'string') return null;
  if (p.paletteLine !== undefined && typeof p.paletteLine !== 'string') return null;
  const letteringWord =
    typeof p.letteringWord === 'string' && p.letteringWord.length > 0 ? p.letteringWord : null;
  return {
    id: p.id,
    title: p.title,
    patternLines: p.patternLines as string[],
    partsLine: p.partsLine,
    letteringWord,
    ...(typeof p.paletteLine === 'string' && p.paletteLine.length > 0
      ? { paletteLine: p.paletteLine }
      : {}),
  };
}

/**
 * 결정적 폴백 플랜 5종 — LLM 없이 코드로 생성 (변주 연산자: 원본/색 반전/스케일 축소/파츠 제로/경계선 사선).
 * planVariants 실패 시에도 파이프라인이 빈손이 되지 않게 하는 안전망.
 */
export function fallbackPlans(brief: NailBrief): VariantPlan[] {
  return [
    {
      id: 'v1',
      title: '오리지널',
      patternLines: brief.patternLines,
      partsLine: brief.partsLine,
      letteringWord: brief.letteringWord,
    },
    {
      id: 'v2',
      title: '컬러 반전',
      patternLines: [
        'Invert figure and ground on every tip: paint each motif in the former background color and each background in the former motif color, keeping the same shapes and placement.',
        ...brief.patternLines,
      ],
      partsLine: brief.partsLine,
      letteringWord: null,
    },
    {
      id: 'v3',
      title: '마이크로 스케일',
      patternLines: [
        'Shrink every motif to micro scale: dots at 0.5-1mm diameter, lines at 0.5mm thickness, keeping the same layout and rhythm.',
        ...brief.patternLines,
      ],
      partsLine: brief.partsLine,
      letteringWord: null,
    },
    {
      id: 'v4',
      title: '핸드페인트 온리',
      patternLines: brief.patternLines,
      partsLine: ZERO_PARTS_LINE,
      letteringWord: null,
    },
    {
      id: 'v5',
      title: '사선 프렌치',
      patternLines: [
        'Redraw every tip boundary as one clean straight diagonal line running from the lower left to the upper right of the tip, with the design fully contained inside the diagonal tip zone.',
        ...brief.patternLines,
      ],
      partsLine: brief.partsLine,
      letteringWord: null,
    },
  ];
}

/**
 * 브리프 → 변주 플랜 5종. Gemini 텍스트 호출(responseSchema, analyzeToBrief와 동일 방식).
 * 스키마 위반·어휘 위반·호출 실패 시 fallbackPlans로 폴백 — LLM 없이도 항상 5개 반환.
 */
export async function planVariants(brief: NailBrief): Promise<VariantPlan[]> {
  if (process.env.GEMINI_MOCK === '1') {
    await new Promise((r) => setTimeout(r, 200));
    return fallbackPlans(brief);
  }
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [{ text: variantInstruction(brief) }],
      config: { responseMimeType: 'application/json', responseSchema: PLANS_SCHEMA },
    });
    return parsePlans(response.text ?? '') ?? fallbackPlans(brief);
  } catch {
    return fallbackPlans(brief);
  }
}

/** JSON 텍스트 → 플랜 5종. 개수·스키마·어휘 위반 시 null (호출부가 폴백) */
export function parsePlans(text: string): VariantPlan[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const rawPlans = (parsed as Record<string, unknown>).plans;
  if (!Array.isArray(rawPlans) || rawPlans.length !== 5) return null;
  const plans: VariantPlan[] = [];
  for (const raw of rawPlans) {
    const plan = parseVariantPlan(raw);
    if (!plan) return null;
    const allText = [plan.title, plan.partsLine, plan.paletteLine ?? '', ...plan.patternLines].join(' ');
    if (hasBannedVocab(allText)) return null; // 어휘 함정 유입 → 세트 전체 폐기(폴백)
    plans.push(plan);
  }
  // 레터링은 최대 2개 플랜까지 — 초과분은 코드에서 제거 (모델은 개수를 못 센다)
  let letteringSeen = 0;
  return plans.map((plan, i) => {
    const keepLettering = plan.letteringWord !== null && letteringSeen < 2;
    if (plan.letteringWord !== null) letteringSeen += keepLettering ? 1 : 0;
    return { ...plan, id: `v${i + 1}`, letteringWord: keepLettering ? plan.letteringWord : null };
  });
}

function variantInstruction(brief: NailBrief): string {
  return `You are a veteran Korean nail artist planning FIVE variant designs from one base design brief.
Each variant keeps the base's mood and palette family but transforms the design using VARIATION OPERATORS.

BASE BRIEF:
- Base: ${brief.baseLine}
- Structure: ${brief.structureLine}
- Palette: ${brief.paletteLine}
- Patterns: ${brief.patternLines.join(' | ')}
- Parts rule: ${brief.partsLine}
- Lettering: ${brief.letteringWord ?? 'none'}
- Mood: ${brief.moodLine}

## Variation operators (pick a DIFFERENT combination of 2-3 per variant — no two variants may share the same combination)
1. Invert — swap figure and ground colors (pink tip with black dots ↔ black tip with white dots)
2. Rescale — micro motifs ↔ big motifs (one scale per tip)
3. Density — dense ↔ sparse, or a shrinking dot trail
4. Boundary swap — smile-line french ↔ diagonal ↔ straight french
5. Material swap — repaint a painted motif as a gel-volume or metal-stud version (or the reverse)
6. Palette rotate — same pattern, rotated to different colors within the base palette

## Output: exactly 5 plans, each with
- id: "v1" to "v5"
- title: a short Korean name for the variant card (e.g. "도트 반전", "레이스 포인트")
- patternLines: 2-5 English lines describing per-tip variations, written as generation instructions
- partsLine: MUST use explicit counts ("Exactly one tip carries ...") AND end by excluding the rest ("Every other tip is painted gel only — no metal, no gems, no pearls."). A zero-parts variant uses "Every tip is painted gel only — no metal, no gems, no pearls, no 3D parts."
- letteringWord: a common 4-6 letter word matching the mood (e.g. Sugar, Honey, Bonbon) in AT MOST 1-2 of the 5 plans; empty string for the rest
- paletteLine: only when the variant rotates the palette; otherwise empty string

## Writing rules (violations make the generation fail)
1. Every noun is drawn literally. For metal parts write "flat gold/silver metal stud shaped as <motif>", "tiny silver microbeads", "small pearl", "small 3D acrylic rose". The words "charm" and "anchor" are forbidden — they draw a hanging pendant and ⚓.
2. Use positive phrasing everywhere: say what IS, precisely.
3. Keep every variant hand-paintable by a human artist with gel.`;
}

const PLANS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    plans: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          title: { type: Type.STRING },
          patternLines: { type: Type.ARRAY, items: { type: Type.STRING } },
          partsLine: { type: Type.STRING },
          letteringWord: { type: Type.STRING },
          paletteLine: { type: Type.STRING },
        },
        required: ['id', 'title', 'patternLines', 'partsLine', 'letteringWord', 'paletteLine'],
      },
    },
  },
  required: ['plans'],
};
