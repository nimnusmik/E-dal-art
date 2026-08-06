# 네일 코어 엔진 재편 구현 계획 (단계 1~3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전역 강제 헌법을 코어 레코드로 옮겨, 코어를 갈아끼우면 완전히 다른 스타일이 나오는 프롬프트 엔진을 만들고 극단 3개 코어로 실측 검증한다.

**Architecture:** `NailBrief` 하나가 짊어지던 책임을 📷`PhotoTake`(사진: 팔레트·모티프·무드)와 🎨`NailCore`(구조·질감·파츠·금지·검수)로 분리한다. `composeBrief`가 둘을 합치며 **코어 우선** 규칙을 실행하고, `buildCorePrompt`가 9단 순서로 프롬프트를 조립한다. 기존 `lib/brief.ts`의 `buildBriefPrompt` 경로는 **손대지 않고 살려두어** 앱이 계속 돌아가게 하고, 새 경로는 실측 스크립트로만 검증한다.

**Tech Stack:** TypeScript (strict), Next.js 15 App Router, `@google/genai`, vitest, tsx

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-08-06-nail-core-presets-design.md` (결정 D1~D10)
- **이미지 모델에 들어가는 모든 문장은 영어.** 사용자 노출 문자열(`nameKo`, `taglineKo`, 무드 키워드)과 코드 주석·커밋 메시지만 한국어 (D4)
- **금지 어휘: `charm`, `anchor`.** 각각 매달린 펜던트와 ⚓를 그린다 (`ref/PARTS_ANALYSIS.md` 5-1절 실측)
- **파츠 물리·구조·질감 서술은 긍정문.** "무엇이 있는가"로 쓴다 — 부정문으로 막으려던 파츠 물리가 뚫린 실측이 있다 (`ref/PARTS_ANALYSIS.md` 5-1절, 고리 3/3 → 0/3)
- **배제 목록은 부정문 허용.** `forbidden` 배열과 `UNIVERSAL_RULES`의 AI티·눈알 차단은 부정문으로 둔다 — 현행 프로덕션(`lib/prompt.ts:52`)에서 검증된 형태다. (2026-08-07 사용자 결정: 긍정문 재작성 시 15개 코어 전량 재작성 + 눈알 차단 약화 위험)
- **모든 명사는 "그림으로 그려지면?"을 기준으로 선택**
- 파츠 개수는 `Exactly one tip...` 형태로 명시하고, 지정 외 팁을 배제하는 문장으로 끝낸다
- 재생성 루프 금지 (D8). judge는 점수만 기록한다
- 테스트: `npm test` (vitest run) / 타입: `npm run typecheck`
- 기존 `lib/prompt.ts`, `lib/brief.ts`의 기존 export는 **제거하지 않는다** — 앱이 사용 중
- 커밋은 태스크 단위. 작업 트리에 랜딩 관련 미커밋 변경이 있으므로 **`git add`는 항상 경로를 명시**한다

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/core.ts` (신규) | `NailCore`·`Material` 타입, 공통분모 규칙 `UNIVERSAL_RULES`, 레지스트리 `getCore`/`allCores` |
| `config/cores/coquette.ts` (신규) | 코케트 코어 — 기존 검증 헌법 이식, 기준선 |
| `config/cores/nuance.ts` (신규) | 뉘앙스 코어 |
| `config/cores/texture-gummy.ts` (신규) | 텍스처·구미 코어 |
| `config/cores/decoden.ts` (신규) | 데코덴·갸루 코어 |
| `config/cores/index.ts` (신규) | 코어 배열 export |
| `lib/photoTake.ts` (신규) | `PhotoTake` 타입, `parsePhotoTake`, `extractPhotoTake`(Gemini 호출) |
| `lib/compose.ts` (신규) | `selectMotifs`(재질 보존), `composeBrief`, `buildCorePrompt` |
| `lib/judge.ts` (수정) | `verdictForCore` + 충실도 3필드 추가. 기존 `verdict`는 유지 |
| `lib/brief.ts` (수정) | `fallbackPlansForCore` 추가. 기존 `fallbackPlans`는 유지 |
| `scripts/generate-core-candidates.mts` (신규) | 코어별 실측 생성 |
| `tests/coreRegistry.test.ts` (신규) | 레지스트리·불변식 |
| `tests/promptBaseline.test.ts` (신규) | 기존 코케트 프롬프트 스냅샷 고정 |
| `tests/photoTake.test.ts` (신규) | 파서 |
| `tests/compose.test.ts` (신규) | 재질 보존 + 조립 순서 |
| `tests/coreEquivalence.test.ts` (신규) | 코케트 등가성 체크리스트 |
| `tests/judgeCore.test.ts` (신규) | 코어 기반 판정 |

## 스펙에서 벗어난 점 2가지 (의도된 수정)

1. **스펙 8절 1단계는 "프롬프트 문자열 스냅샷 테스트"로 코케트 회귀 0을 검증한다고 썼다.** 그런데 `PhotoTake`가 팔레트 표현을 바꾸므로 **문자열 완전 일치는 불가능**하다. 대신 두 개로 나눈다:
   - `tests/promptBaseline.test.ts` — **기존** `buildBriefPrompt` 출력을 스냅샷으로 고정 (기존 경로 회귀 가드)
   - `tests/coreEquivalence.test.ts` — **새** 코케트 경로가 옛 프롬프트의 **모든 하중 제약**(여백·딥프렌치·파츠물리·금지·공통규칙)을 담고 있는지 체크리스트로 검증
2. **`motifBudget: number` 필드를 `NailCore`에 추가한다.** 스펙 5-3절의 예산 규칙은 "팁 단위"로 썼는데, 사진 모티프에는 페인트 모티프(파츠 아님)가 섞여 있어 `partsBudget`으로 셀 수 없다. 코어가 한 세트에서 소화할 **사진 모티프 최대 개수**를 별도 숫자로 둔다.

---

### Task 1: NailCore 타입 + 공통분모 규칙 + 레지스트리

**Files:**
- Create: `lib/core.ts`
- Create: `config/cores/index.ts`
- Test: `tests/coreRegistry.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `type Material = 'painted' | 'gel-volume' | 'metal' | 'pearl' | 'chrome' | 'sculpted'`
  - `type CoreStructure = 'one-tone' | 'french' | 'deep-french' | 'full-cover' | 'layered-sheer'`
  - `interface NailCore` (아래 전체 정의)
  - `const UNIVERSAL_RULES: string[]`
  - `function allCores(): NailCore[]`
  - `function getCore(id: string): NailCore | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/coreRegistry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { allCores, getCore, UNIVERSAL_RULES } from '@/lib/core';

describe('코어 레지스트리', () => {
  it('없는 id는 null', () => {
    expect(getCore('nope')).toBeNull();
  });

  it('등록된 모든 코어를 id로 찾을 수 있다', () => {
    for (const core of allCores()) {
      expect(getCore(core.id), core.id).toBe(core);
    }
  });

  it('id는 중복되지 않는다', () => {
    const ids = allCores().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('공통분모 규칙은 4줄이고 모두 영어', () => {
    expect(UNIVERSAL_RULES).toHaveLength(4);
    for (const line of UNIVERSAL_RULES) {
      expect(line).not.toMatch(/[가-힣]/);
    }
  });

  it('모든 코어는 금지 어휘 charm·anchor를 프롬프트 문장에 쓰지 않는다', () => {
    for (const core of allCores()) {
      const text = [
        core.baseLine,
        core.finishMix,
        core.partsPhysics,
        ...core.textureGrammar,
        ...core.signature,
        ...core.forbidden,
        ...Object.values(core.designZone),
      ].join(' ');
      expect(text).not.toMatch(/\bcharms?\b|\banchors?\b/i);
    }
  });

  it('모든 코어의 모델 입력 문장에 한글이 섞이지 않는다', () => {
    for (const core of allCores()) {
      const text = [core.baseLine, core.finishMix, core.partsPhysics, ...core.signature].join(' ');
      expect(text, core.id).not.toMatch(/[가-힣]/);
    }
  });

  it('모든 코어는 사용자 노출 문자열을 한국어로 갖는다', () => {
    for (const core of allCores()) {
      expect(core.nameKo, core.id).toMatch(/[가-힣]/);
      expect(core.taglineKo, core.id).toMatch(/[가-힣]/);
    }
  });

  it('negativeSpace는 [min, max] 순서이고 0~1 범위', () => {
    for (const core of allCores()) {
      const [min, max] = core.negativeSpace;
      expect(min, core.id).toBeLessThanOrEqual(max);
      expect(min, core.id).toBeGreaterThanOrEqual(0);
      expect(max, core.id).toBeLessThanOrEqual(1);
    }
  });

  it('judge 파츠 범위는 min <= max', () => {
    for (const core of allCores()) {
      expect(core.judge.minPartsTips, core.id).toBeLessThanOrEqual(core.judge.maxPartsTips);
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/coreRegistry.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/core"`

- [ ] **Step 3: `lib/core.ts`를 만든다**

```ts
/**
 * 코어(-core) = 사용자가 선택하는 미감 정체성 = 독립된 프롬프트 헌법.
 *
 * 설계 근거: docs/superpowers/specs/2026-08-06-nail-core-presets-design.md
 * 기존에 lib/prompt.ts·lib/brief.ts에 전역으로 강제되던 스타일 규칙
 * (PARTS_PHYSICS·LENGTH_RULES·HUMAN_ARTIST_LINES)을 이 레코드로 옮긴다.
 * 전역에 남는 것은 UNIVERSAL_RULES 4줄뿐.
 */

/** 파츠·모티프의 재질. 사진 재질 보존 판정(D7)에 사용 */
export type Material = 'painted' | 'gel-volume' | 'metal' | 'pearl' | 'chrome' | 'sculpted';

export type CoreStructure = 'one-tone' | 'french' | 'deep-french' | 'full-cover' | 'layered-sheer';

export type LengthKey = 'short' | 'medium' | 'long';

export interface NailCore {
  id: string;
  /** 사용자 노출 — 한국어 */
  nameKo: string;
  /** 카드 설명 한 줄 — 한국어 */
  taglineKo: string;
  /** 소음 지수. UI 그리드 정렬 순서 = 이 값 오름차순 */
  noise: 1 | 2 | 3 | 4 | 5;

  // ── 구조 (영어) ──
  baseLine: string;
  structure: CoreStructure;
  /** 여백률 범위 [min, max] */
  negativeSpace: [number, number];
  /** 기존 LENGTH_RULES 대체 — 길이별 디자인 영역 규칙 */
  designZone: Record<LengthKey, string>;

  // ── 질감·마감 ──
  textureGrammar: string[];
  finishMix: string;

  // ── 파츠 ──
  partsPhysics: string;
  partsBudget: { big: number; studs: [number, number] };
  /** 사진 재질 보존 판정용 — 이 코어가 다룰 수 있는 재질 */
  allowedMaterials: Material[];
  /** 이 코어가 한 세트에서 소화할 사진 모티프 최대 개수 */
  motifBudget: number;

  // ── 개성 (자유 작문 3~5줄) ──
  signature: string[];

  // ── 제약 (이 코어에서만) ──
  forbidden: string[];

  /** 변주 연산자 — 코어 정체성을 깨지 않는 것만 */
  variantOps: string[];

  /** 생성 시 원본 사진을 모델에 첨부할지 (D6 — 3단계 실측에서 확정) */
  attachPhoto: boolean;

  judge: {
    minPartsTips: number;
    maxPartsTips: number;
    allowGelVolume: boolean;
    minNegativeSpace: number;
  };
}

/**
 * 15개 코어 전부에 적용되는 공통분모. 이 4줄 외의 모든 스타일 규칙은
 * 코어 레코드가 소유한다. (팁셋 플랫레이 기준 — 손 착용샷 규칙은 lib/prompt.ts에 남아 있음)
 */
export const UNIVERSAL_RULES: string[] = [
  'Every element is physically buildable by hand with gel, powder, film, and attachable parts, each part sealed under a layer of clear gel.',
  'The render reads as a photograph of real finished nail tips: crisp edges, honest material behaviour, no melted or smeared boundaries, no warped silhouettes.',
  'Keep believable hand-made character: micro-variations between tips, natural gel thickness and edge highlights, not computer-perfect symmetry.',
  'Keep it abstract nail art: no eyes, eyeballs, iris or pupil shapes, no faces.',
];

import { CORES } from '@/config/cores';

export function allCores(): NailCore[] {
  return CORES;
}

export function getCore(id: string): NailCore | null {
  return CORES.find((c) => c.id === id) ?? null;
}
```

- [ ] **Step 4: `config/cores/index.ts`를 만든다 (지금은 빈 배열)**

```ts
import type { NailCore } from '@/lib/core';

/**
 * 등록된 코어. 배열 순서는 무의미하며, UI 정렬은 noise 오름차순으로 계산한다.
 * 스펙 2-2절의 15종 중 단계 1~3 범위인 4종만 우선 등록.
 */
export const CORES: NailCore[] = [];
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/coreRegistry.test.ts`
Expected: PASS (9 tests)

레지스트리가 비어 있어도 통과한다 — 순회 테스트는 등록된 코어에 대한 불변식이고, `getCore('nope')` 는 빈 레지스트리에서도 `null`이다. 코어가 등록되는 Task 3·9에서 같은 불변식이 자동으로 적용된다. **의도적으로 실패를 남기지 않는다.**

- [ ] **Step 6: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 7: 커밋**

```bash
git add lib/core.ts config/cores/index.ts tests/coreRegistry.test.ts
git commit -m "feat(core): NailCore 타입·공통분모 규칙·레지스트리 추가

전역 강제 헌법을 코어 레코드로 옮기기 위한 기반. 공통분모는 4줄만 남긴다."
```

---

### Task 2: 기존 코케트 프롬프트 스냅샷 고정 (회귀 가드)

리팩터링 중 기존 경로가 변형되는 걸 막는 안전망. **먼저 깔아야 한다.**

**Files:**
- Test: `tests/promptBaseline.test.ts`

**Interfaces:**
- Consumes: `buildBriefPrompt(brief: NailBrief): string` from `lib/brief.ts` (기존)
- Produces: 없음 (테스트 전용)

- [ ] **Step 1: 스냅샷 테스트를 쓴다**

`tests/promptBaseline.test.ts`:

```ts
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
```

- [ ] **Step 2: 테스트를 실행해 스냅샷을 생성한다**

Run: `npm test -- tests/promptBaseline.test.ts`
Expected: PASS, `tests/__snapshots__/promptBaseline.test.ts.snap` 생성됨 (`1 snapshot written`)

- [ ] **Step 3: 스냅샷 파일이 만들어졌는지 확인한다**

Run: `cat tests/__snapshots__/promptBaseline.test.ts.snap | head -20`
Expected: `exports[`기존 코케트 프롬프트 (회귀 가드) > 프롬프트 문자열이 스냅샷과 일치한다 1`]` 로 시작하는 내용

- [ ] **Step 4: 커밋**

```bash
git add tests/promptBaseline.test.ts tests/__snapshots__/promptBaseline.test.ts.snap
git commit -m "test(brief): 기존 코케트 프롬프트 스냅샷 고정

코어 리팩터링 중 검증된 유일한 자산이 변형되는 것을 막는 회귀 가드."
```

---

### Task 3: 코케트 코어 (기준선 이식)

기존 헌법을 코어 레코드로 옮긴다. **새로 쓰는 게 아니라 이식**이다 — 문장을 바꾸면 검증이 무효가 된다.

**Files:**
- Create: `config/cores/coquette.ts`
- Modify: `config/cores/index.ts`
- Test: `tests/coreRegistry.test.ts` (Task 1에서 작성, 이제 통과)

**Interfaces:**
- Consumes: `NailCore`, `Material` from `lib/core.ts`
- Produces: `const coquette: NailCore`

- [ ] **Step 1: `config/cores/coquette.ts`를 만든다**

문장 출처를 주석에 남긴다. `partsPhysics`는 `lib/brief.ts:192` `PARTS_PHYSICS`, `designZone`은 `lib/brief.ts:198-205` `LENGTH_RULES`에서 **문자 그대로** 가져온다.

```ts
import type { NailCore } from '@/lib/core';

/**
 * 코케트 코어 — 유일하게 검증 완료된 헌법 (ref/trendy/STYLE_ANALYSIS.md v2).
 * 문장은 lib/brief.ts의 PARTS_PHYSICS·LENGTH_RULES에서 그대로 이식했다.
 * 여기를 고치면 기준선이 무효가 되므로, 실측 없이 문장을 바꾸지 않는다.
 */
export const coquette: NailCore = {
  id: 'coquette',
  nameKo: '코케트',
  taglineKo: '소녀 시절 아카이브를 어른의 절제로',
  noise: 3,

  baseLine: 'Base of every tip: sheer milky nude with a glass-like high-gloss gel finish.',
  structure: 'deep-french',
  // STYLE_ANALYSIS.md E절: 여백률 55~70%
  negativeSpace: [0.55, 0.7],
  designZone: {
    short:
      'Length rule (short tips): the design zone shrinks to 20-30% of each nail — keep every motif micro-scale: micro dots (0.5-1mm) and thin 0.5mm lines only, each element flat-painted and fully contained inside that compact zone.',
    medium:
      'Length rule (medium tips): the design zone covers 30-45% of each nail — standard deep-french depth.',
    long:
      'Length rule (long tips): the design zone may run deep — deep-french coverage, script lettering, and a single centerpiece part on one hero tip are all welcome.',
  },

  textureGrammar: [],
  finishMix: 'One single finish across the whole set: glass-like high gloss on every tip.',

  // lib/brief.ts:192 PARTS_PHYSICS 그대로
  partsPhysics:
    'METAL PART PHYSICS: every metal part is a FLAT embossed metal stud lying flush ON the nail surface, sealed under a layer of clear gel — glued down like a sticker with slight thickness. Each stud is a SOLID CAST shape with a clean closed outline, exactly the motif silhouette and nothing more. The stud stays fully inside the nail\'s outline.',
  // STYLE_ANALYSIS.md E절: 빅파츠 1개 + 미니 스터드 3~6개
  partsBudget: { big: 1, studs: [3, 6] },
  allowedMaterials: ['painted', 'metal', 'pearl'],
  motifBudget: 3,

  signature: [
    'The design lives only inside the deep-french tip zone; the nude zone above the boundary stays empty and glossy, and that emptiness is the point.',
    // STYLE_ANALYSIS C절의 "앵커" 역할. 영어 anchor는 ⚓를 그리므로 focal tip으로 쓴다
    'Across the set one tip is the focal tip (script lettering or a single centerpiece part), two or three tips are rhythm variations of the same motif, and one tip stays almost bare nude.',
    'The same motif returns in different materials across the set: a painted dot on one tip, a metal stud dot on another, a pearl on a third.',
    'The tip boundary is a smile line by default, occasionally redrawn as a clean diagonal or straight line.',
  ],

  // STYLE_ANALYSIS.md G절: 12장 전체에서 0회 등장한 것들
  forbidden: [
    'marble veining',
    'chunky full-cover glitter',
    'ombre gradient french',
    'matte finish',
    'neon or vivid saturation',
    'full-surface pattern with no french boundary',
    'parts that hang, dangle, or swing',
    'parts taller than the nail curve',
  ],

  variantOps: ['invert', 'rescale', 'density', 'zero-parts', 'boundary-swap'],
  attachPhoto: false,

  judge: { minPartsTips: 1, maxPartsTips: 2, allowGelVolume: false, minNegativeSpace: 0.55 },
};
```

- [ ] **Step 2: `config/cores/index.ts`에 등록한다**

```ts
import type { NailCore } from '@/lib/core';
import { coquette } from './coquette';

/**
 * 등록된 코어. 배열 순서는 무의미하며, UI 정렬은 noise 오름차순으로 계산한다.
 * 스펙 2-2절의 15종 중 단계 1~3 범위인 4종만 우선 등록.
 */
export const CORES: NailCore[] = [coquette];
```

- [ ] **Step 3: 코케트 등록을 확인하는 테스트를 추가한다**

`tests/coreRegistry.test.ts`의 `describe('코어 레지스트리')` 안에 추가한다:

```ts
  it('코케트가 등록되어 있다', () => {
    expect(getCore('coquette')?.nameKo).toBe('코케트');
  });
```

Run: `npm test -- tests/coreRegistry.test.ts`
Expected: PASS (10 tests) — Task 1의 순회 불변식(금지 어휘·한글 혼입·범위)이 코케트에도 자동 적용된다

- [ ] **Step 4: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add config/cores/coquette.ts config/cores/index.ts tests/coreRegistry.test.ts
git commit -m "feat(core): 코케트 코어 이식 — 검증된 헌법을 레코드로

lib/brief.ts의 PARTS_PHYSICS·LENGTH_RULES 문장을 그대로 옮겨 기준선 확보."
```

---

### Task 4: PhotoTake 타입 + 파서

**Files:**
- Create: `lib/photoTake.ts`
- Test: `tests/photoTake.test.ts`

**Interfaces:**
- Consumes: `Material` from `lib/core.ts`
- Produces:
  - `interface PhotoMotif { name: string; material: Material; scale: 'micro'|'standard'|'big'; prominence: 1|2|3 }`
  - `interface PaletteEntry { hex: string; role: 'base'|'main'|'accent'; ratio: number; nameEn: string }`
  - `interface PhotoTake { palette: PaletteEntry[]; motifs: PhotoMotif[]; moodKo: string[]; moodEn: string; tone: {...}; fidelityAnchors: string[] }`
  - `function parsePhotoTake(text: string): PhotoTake | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/photoTake.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parsePhotoTake } from '@/lib/photoTake';

const VALID = {
  palette: [
    { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
    { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
    { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
  ],
  motifs: [
    { name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 },
    { name: 'small pearl', material: 'pearl', scale: 'micro', prominence: 1 },
  ],
  moodKo: ['코케트', '파스텔'],
  moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
  tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
  fidelityAnchors: ['pastel polka dots inside the tip zone', 'milky nude negative space'],
};

describe('parsePhotoTake', () => {
  it('올바른 JSON을 파싱한다', () => {
    const take = parsePhotoTake(JSON.stringify(VALID));
    expect(take?.palette).toHaveLength(3);
    expect(take?.motifs[0].name).toBe('polka dot');
    expect(take?.tone.saturation).toBe('muted');
  });

  it('JSON이 아니면 null', () => {
    expect(parsePhotoTake('not json')).toBeNull();
  });

  it('팔레트가 비면 null', () => {
    expect(parsePhotoTake(JSON.stringify({ ...VALID, palette: [] }))).toBeNull();
  });

  it('role이 규정 외면 null', () => {
    const bad = { ...VALID, palette: [{ ...VALID.palette[0], role: 'highlight' }] };
    expect(parsePhotoTake(JSON.stringify(bad))).toBeNull();
  });

  it('material이 규정 외면 null', () => {
    const bad = { ...VALID, motifs: [{ ...VALID.motifs[0], material: 'plastic' }] };
    expect(parsePhotoTake(JSON.stringify(bad))).toBeNull();
  });

  it('hex 형식이 아니면 null', () => {
    const bad = { ...VALID, palette: [{ ...VALID.palette[0], hex: 'pink' }] };
    expect(parsePhotoTake(JSON.stringify(bad))).toBeNull();
  });

  it('모티프가 0개인 사진(원톤)은 허용한다', () => {
    const take = parsePhotoTake(JSON.stringify({ ...VALID, motifs: [] }));
    expect(take?.motifs).toEqual([]);
  });

  it('모티프 8개 초과는 prominence 높은 순 8개로 자른다', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `motif ${i}`,
      material: 'painted',
      scale: 'standard',
      prominence: ((i % 3) + 1) as 1 | 2 | 3,
    }));
    const take = parsePhotoTake(JSON.stringify({ ...VALID, motifs: many }));
    expect(take?.motifs).toHaveLength(8);
    expect(take?.motifs[0].prominence).toBe(3);
  });

  it('ratio 합계가 1이 아니면 1로 정규화한다', () => {
    const bad = {
      ...VALID,
      palette: VALID.palette.map((p) => ({ ...p, ratio: 1 })),
    };
    const take = parsePhotoTake(JSON.stringify(bad));
    const sum = take!.palette.reduce((s, p) => s + p.ratio, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/photoTake.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/photoTake"`

- [ ] **Step 3: `lib/photoTake.ts`의 타입과 파서를 구현한다**

```ts
import type { Material } from './core';

/**
 * 📷 사진에서만 뽑는 것 — 팔레트·모티프·무드 (스펙 4절 소유권 분리).
 * 구조·질감·파츠는 코어가 소유하므로 여기에 없다.
 */

export type Scale = 'micro' | 'standard' | 'big';
export type Prominence = 1 | 2 | 3;

export interface PhotoMotif {
  /** 'polka dot' | 'leopard print' | 'baroque relief' — 구조 서술 없이 모티프 이름만 */
  name: string;
  material: Material;
  scale: Scale;
  /** 사진에서의 지배력. 코어 예산 배분 순위로 쓰인다 */
  prominence: Prominence;
}

export interface PaletteEntry {
  hex: string;
  role: 'base' | 'main' | 'accent';
  /** 0~1, 합계 1.0 */
  ratio: number;
  /** 'baby pink' — 모델은 색 이름을 hex보다 잘 이해한다 */
  nameEn: string;
}

export interface PhotoTake {
  palette: PaletteEntry[];
  /** 상한 8개. 사진에 있는 만큼 뽑고 prominence로 순위를 매긴다 */
  motifs: PhotoMotif[];
  moodKo: string[];
  moodEn: string;
  tone: {
    saturation: 'muted' | 'medium' | 'vivid';
    brightness: 'dark' | 'mid' | 'light';
    temperature: 'cool' | 'neutral' | 'warm';
  };
  /** "반드시 살아야 함" 2~3개 — judge 충실도 채점용 */
  fidelityAnchors: string[];
}

const MATERIALS = new Set<string>([
  'painted', 'gel-volume', 'metal', 'pearl', 'chrome', 'sculpted',
]);
const ROLES = new Set(['base', 'main', 'accent']);
const SCALES = new Set(['micro', 'standard', 'big']);
const SATURATIONS = new Set(['muted', 'medium', 'vivid']);
const BRIGHTNESSES = new Set(['dark', 'mid', 'light']);
const TEMPERATURES = new Set(['cool', 'neutral', 'warm']);

const MOTIF_LIMIT = 8;

/** JSON 텍스트 → PhotoTake. 스키마 위반 시 null (호출부가 폴백) */
export function parsePhotoTake(text: string): PhotoTake | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const t = parsed as Record<string, unknown>;

  const palette = parsePalette(t.palette);
  if (!palette) return null;

  const motifs = parseMotifs(t.motifs);
  if (!motifs) return null;

  if (!isStrArr(t.moodKo) || t.moodKo.length === 0) return null;
  if (typeof t.moodEn !== 'string' || t.moodEn.length === 0) return null;
  if (!isStrArr(t.fidelityAnchors)) return null;

  const tone = t.tone;
  if (typeof tone !== 'object' || tone === null) return null;
  const to = tone as Record<string, unknown>;
  if (typeof to.saturation !== 'string' || !SATURATIONS.has(to.saturation)) return null;
  if (typeof to.brightness !== 'string' || !BRIGHTNESSES.has(to.brightness)) return null;
  if (typeof to.temperature !== 'string' || !TEMPERATURES.has(to.temperature)) return null;

  return {
    palette,
    motifs,
    moodKo: t.moodKo,
    moodEn: t.moodEn,
    tone: {
      saturation: to.saturation as PhotoTake['tone']['saturation'],
      brightness: to.brightness as PhotoTake['tone']['brightness'],
      temperature: to.temperature as PhotoTake['tone']['temperature'],
    },
    fidelityAnchors: t.fidelityAnchors,
  };
}

function isStrArr(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function parsePalette(value: unknown): PaletteEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const entries: PaletteEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(p.hex)) return null;
    if (typeof p.role !== 'string' || !ROLES.has(p.role)) return null;
    if (typeof p.nameEn !== 'string' || p.nameEn.length === 0) return null;
    if (typeof p.ratio !== 'number' || !Number.isFinite(p.ratio) || p.ratio <= 0) return null;
    entries.push({
      hex: p.hex.toLowerCase(),
      role: p.role as PaletteEntry['role'],
      ratio: p.ratio,
      nameEn: p.nameEn,
    });
  }
  // 모델이 비율을 못 맞추므로 합계 1.0으로 정규화한다
  const sum = entries.reduce((s, e) => s + e.ratio, 0);
  return entries.map((e) => ({ ...e, ratio: e.ratio / sum }));
}

function parseMotifs(value: unknown): PhotoMotif[] | null {
  if (!Array.isArray(value)) return null;
  const motifs: PhotoMotif[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return null;
    const m = raw as Record<string, unknown>;
    if (typeof m.name !== 'string' || m.name.length === 0) return null;
    if (typeof m.material !== 'string' || !MATERIALS.has(m.material)) return null;
    if (typeof m.scale !== 'string' || !SCALES.has(m.scale)) return null;
    if (m.prominence !== 1 && m.prominence !== 2 && m.prominence !== 3) return null;
    motifs.push({
      name: m.name,
      material: m.material as Material,
      scale: m.scale as Scale,
      prominence: m.prominence,
    });
  }
  // 상한 초과는 지배력 높은 순으로 자른다 (사진 정보를 버리는 유일한 지점)
  return [...motifs].sort((a, b) => b.prominence - a.prominence).slice(0, MOTIF_LIMIT);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/photoTake.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/photoTake.ts tests/photoTake.test.ts
git commit -m "feat(photo): PhotoTake 타입·파서 추가

팔레트에 역할·배합비를, 모티프에 재질·스케일·지배력을 담아
사진 특징을 구조화한다. 구조 서술은 코어 소유이므로 제외."
```

---

### Task 5: extractPhotoTake — Gemini 호출

**Files:**
- Modify: `lib/photoTake.ts`
- Test: `tests/photoTake.test.ts` (mock 경로 추가)

**Interfaces:**
- Consumes: `parsePhotoTake`, `ImagePayload` from `lib/types.ts`
- Produces: `async function extractPhotoTake(images: ImagePayload[]): Promise<PhotoTake | null>`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`tests/photoTake.test.ts` 맨 아래에 붙인다:

```ts
import { extractPhotoTake } from '@/lib/photoTake';

describe('extractPhotoTake (mock)', () => {
  it('GEMINI_MOCK=1이면 목 결과를 반환한다', async () => {
    process.env.GEMINI_MOCK = '1';
    const take = await extractPhotoTake([]);
    expect(take?.palette.length).toBeGreaterThan(0);
    expect(take?.palette.some((p) => p.role === 'base')).toBe(true);
    delete process.env.GEMINI_MOCK;
  });

  it('목 결과의 ratio 합계는 1', async () => {
    process.env.GEMINI_MOCK = '1';
    const take = await extractPhotoTake([]);
    const sum = take!.palette.reduce((s, p) => s + p.ratio, 0);
    expect(sum).toBeCloseTo(1, 5);
    delete process.env.GEMINI_MOCK;
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/photoTake.test.ts`
Expected: FAIL — `extractPhotoTake is not a function`

- [ ] **Step 3: `lib/photoTake.ts`에 호출부를 추가한다**

파일 상단 import를 고치고:

```ts
import { GoogleGenAI, Type } from '@google/genai';
import type { Material } from './core';
import type { ImagePayload } from './types';
```

파일 맨 아래에 추가:

```ts
/** 사진 → PhotoTake. 일시 오류 대비 1회 재시도, 최종 실패 시 null */
export async function extractPhotoTake(images: ImagePayload[]): Promise<PhotoTake | null> {
  const first = await extractOnce(images);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 2000));
  return extractOnce(images);
}

async function extractOnce(images: ImagePayload[]): Promise<PhotoTake | null> {
  if (process.env.GEMINI_MOCK === '1') return mockPhotoTake();
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [
        ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
        { text: EXTRACT_INSTRUCTION },
      ],
      config: { responseMimeType: 'application/json', responseSchema: PHOTO_TAKE_SCHEMA },
    });
    return parsePhotoTake(response.text ?? '');
  } catch {
    return null;
  }
}

const EXTRACT_INSTRUCTION = `You are a veteran Korean nail artist reading inspiration photos a client brought in.
Extract ONLY three things: the colour palette, the motif vocabulary, and the mood.
Do NOT describe layout, structure, french depth, negative space, or where things sit on the nail — a separate style system owns all of that. Describing placement will corrupt the pipeline.

## palette
List 3-5 colours. For each: hex, a plain English colour name, its role, and how much of the surface it covers.
- role "base" = the ground colour the nail starts from
- role "main" = the colours the design is drawn in
- role "accent" = small-quantity colours used for lines, dots, or metal
- ratio: your estimate of surface share, all ratios summing to about 1.0

## motifs
List every distinct motif you can see, up to 8. For each:
- name: the motif itself as a noun phrase ("polka dot", "leopard print", "baroque relief", "cable knit", "hand-painted rose"). No placement words.
- material: how it is physically made — "painted" (brush on gel), "gel-volume" (raised clear or tinted gel), "metal" (cast stud or bead), "pearl" (domed pearl), "chrome" (mirror powder), "sculpted" (hand-shaped 3D gel or acrylic form)
- scale: micro (under 1mm) / standard / big (3mm+)
- prominence: 3 = dominates the photo, 2 = clearly present, 1 = minor detail
If the photo is a plain one-tone manicure with no motifs, return an empty array.

## mood
- moodKo: 2-3 short Korean mood words
- moodEn: one short English mood sentence
- tone: overall saturation, brightness, and colour temperature
- fidelityAnchors: 2-3 short English phrases naming what MUST survive for the client to recognise their photo`;

const PHOTO_TAKE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    palette: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hex: { type: Type.STRING },
          nameEn: { type: Type.STRING },
          role: { type: Type.STRING, enum: ['base', 'main', 'accent'] },
          ratio: { type: Type.NUMBER },
        },
        required: ['hex', 'nameEn', 'role', 'ratio'],
      },
    },
    motifs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          material: {
            type: Type.STRING,
            enum: ['painted', 'gel-volume', 'metal', 'pearl', 'chrome', 'sculpted'],
          },
          scale: { type: Type.STRING, enum: ['micro', 'standard', 'big'] },
          prominence: { type: Type.INTEGER },
        },
        required: ['name', 'material', 'scale', 'prominence'],
      },
    },
    moodKo: { type: Type.ARRAY, items: { type: Type.STRING } },
    moodEn: { type: Type.STRING },
    tone: {
      type: Type.OBJECT,
      properties: {
        saturation: { type: Type.STRING, enum: ['muted', 'medium', 'vivid'] },
        brightness: { type: Type.STRING, enum: ['dark', 'mid', 'light'] },
        temperature: { type: Type.STRING, enum: ['cool', 'neutral', 'warm'] },
      },
      required: ['saturation', 'brightness', 'temperature'],
    },
    fidelityAnchors: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['palette', 'motifs', 'moodKo', 'moodEn', 'tone', 'fidelityAnchors'],
};

/** 로컬 개발용 목 (GEMINI_MOCK=1) — 실제 호출·과금 없이 전체 흐름 확인 */
async function mockPhotoTake(): Promise<PhotoTake> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    palette: [
      { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
      { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
      { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
    ],
    motifs: [
      { name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 },
      { name: 'small pearl', material: 'pearl', scale: 'micro', prominence: 1 },
    ],
    moodKo: ['코케트', '파스텔'],
    moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
    tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
    fidelityAnchors: ['pastel polka dots', 'milky nude ground'],
  };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/photoTake.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add lib/photoTake.ts tests/photoTake.test.ts
git commit -m "feat(photo): extractPhotoTake — 사진에서 팔레트·모티프·무드만 추출

지시문에 배치·구조 서술 금지를 명시. 구조를 뽑으면 코어와 충돌한다."
```

---

### Task 6: 재질 보존 규칙 (selectMotifs)

**Files:**
- Create: `lib/compose.ts`
- Test: `tests/compose.test.ts`

**Interfaces:**
- Consumes: `NailCore` from `lib/core.ts`, `PhotoMotif` from `lib/photoTake.ts`
- Produces: `function selectMotifs(core: NailCore, motifs: PhotoMotif[]): PhotoMotif[]`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/compose.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { selectMotifs } from '@/lib/compose';
import { coquette } from '@/config/cores/coquette';
import type { PhotoMotif } from '@/lib/photoTake';

const dot: PhotoMotif = { name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 };
const pearl: PhotoMotif = { name: 'small pearl', material: 'pearl', scale: 'micro', prominence: 2 };
const lily: PhotoMotif = { name: 'sculpted lily', material: 'sculpted', scale: 'big', prominence: 3 };
const chromeSwirl: PhotoMotif = { name: 'chrome swirl', material: 'chrome', scale: 'standard', prominence: 1 };

describe('selectMotifs — 재질 보존 규칙 (D7)', () => {
  it('허용 재질 모티프는 재질을 바꾸지 않고 그대로 통과시킨다', () => {
    const picked = selectMotifs(coquette, [dot, pearl]);
    expect(picked).toEqual([dot, pearl]);
  });

  it('허용되지 않은 재질은 변환하지 않고 제외한다', () => {
    // coquette.allowedMaterials = ['painted','metal','pearl'] — sculpted·chrome 없음
    const picked = selectMotifs(coquette, [lily, dot, chromeSwirl]);
    expect(picked).toEqual([dot]);
    expect(picked.some((m) => m.material === 'sculpted')).toBe(false);
  });

  it('제외된 자리는 다음 prominence 모티프가 채운다', () => {
    const core = { ...coquette, motifBudget: 2 };
    const low: PhotoMotif = { name: 'thin stripe', material: 'painted', scale: 'micro', prominence: 1 };
    const picked = selectMotifs(core, [lily, dot, low]);
    expect(picked).toEqual([dot, low]);
  });

  it('motifBudget을 넘으면 prominence 높은 순으로 자른다', () => {
    const core = { ...coquette, motifBudget: 1 };
    expect(selectMotifs(core, [pearl, dot])).toEqual([dot]);
  });

  it('모티프가 없으면 빈 배열 (원톤 사진)', () => {
    expect(selectMotifs(coquette, [])).toEqual([]);
  });

  it('허용 재질이 하나도 없으면 빈 배열 — 억지로 채우지 않는다', () => {
    expect(selectMotifs(coquette, [lily, chromeSwirl])).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/compose.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/compose"`

- [ ] **Step 3: `lib/compose.ts`를 만든다**

```ts
import type { NailCore } from './core';
import type { PhotoMotif } from './photoTake';

/**
 * 📷 PhotoTake + 🎨 NailCore → 생성 프롬프트.
 * 조립 규칙은 코어 우선(D5): 코어가 구조를 정하고, 사진은 색과 모양만 제공한다.
 */

/**
 * 재질 보존 규칙 (D7).
 *  1. 코어가 다룰 수 있는 재질이면 그대로 유지 — 변환하지 않는다
 *  2. 다룰 수 없으면 제외하고, 다음 prominence 모티프가 그 자리를 채운다
 *  3. motifBudget까지만 채운다 (코어 시그니처가 나머지를 채움)
 */
export function selectMotifs(core: NailCore, motifs: PhotoMotif[]): PhotoMotif[] {
  return motifs
    .filter((m) => core.allowedMaterials.includes(m.material))
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, core.motifBudget);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/compose.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add lib/compose.ts tests/compose.test.ts
git commit -m "feat(compose): 재질 보존 규칙 — 사진 재질은 유지하거나 제외, 변환 금지

허용 재질이 아니면 억지로 바꾸지 않고 뺀다. 나오는 재질은 항상 사진 그대로."
```

---

### Task 7: composeBrief + buildCorePrompt

**Files:**
- Modify: `lib/compose.ts`
- Test: `tests/compose.test.ts`

**Interfaces:**
- Consumes: `selectMotifs`, `NailCore`, `UNIVERSAL_RULES`, `PhotoTake`, `NailShape`/`NailLength`/`PartsIntensity` from `lib/types.ts`
- Produces:
  - `interface CoreBrief { core: NailCore; photo: PhotoTake; shape: NailShape; length: LengthKey; motifs: PhotoMotif[]; patternLines: string[]; letteringWord: string | null }`
  - `function composeBrief(core, photo, opts): CoreBrief`
  - `function buildCorePrompt(brief: CoreBrief): string`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`tests/compose.test.ts` 맨 아래에 붙인다:

```ts
import { composeBrief, buildCorePrompt } from '@/lib/compose';
import { UNIVERSAL_RULES } from '@/lib/core';
import type { PhotoTake } from '@/lib/photoTake';

const PHOTO: PhotoTake = {
  palette: [
    { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
    { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
    { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
  ],
  motifs: [dot, pearl],
  moodKo: ['코케트'],
  moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
  tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
  fidelityAnchors: ['pastel polka dots'],
};

const OPTS = { shape: 'almond' as const, length: 'medium' as const, partsIntensity: 'auto' as const };

describe('composeBrief', () => {
  it('사용자 주문 쉐입·길이를 담는다', () => {
    const brief = composeBrief(coquette, PHOTO, OPTS);
    expect(brief.shape).toBe('almond');
    expect(brief.length).toBe('medium');
  });

  it('재질 보존 규칙을 통과한 모티프만 담는다', () => {
    const brief = composeBrief(coquette, { ...PHOTO, motifs: [lily, dot] }, OPTS);
    expect(brief.motifs).toEqual([dot]);
  });

  it('partsIntensity=none이면 파츠 재질 모티프가 빠진다', () => {
    const brief = composeBrief(coquette, PHOTO, { ...OPTS, partsIntensity: 'none' });
    expect(brief.motifs.some((m) => m.material === 'pearl')).toBe(false);
    expect(brief.motifs.some((m) => m.material === 'painted')).toBe(true);
  });
});

describe('buildCorePrompt — 조립 순서 (D5: 코어 우선)', () => {
  const prompt = buildCorePrompt(composeBrief(coquette, PHOTO, OPTS));

  it('코어 구조가 사진 팔레트보다 먼저 나온다', () => {
    const baseAt = prompt.indexOf('Base of every tip');
    const paletteAt = prompt.indexOf('Palette:');
    expect(baseAt).toBeGreaterThan(-1);
    expect(paletteAt).toBeGreaterThan(-1);
    expect(baseAt).toBeLessThan(paletteAt);
  });

  it('코어 시그니처가 사진 모티프보다 먼저 나온다', () => {
    // indexOf는 대소문자를 구분한다. 못 찾으면 -1이 되어 비교가 무조건 통과하므로
    // 먼저 존재를 확인한 뒤 순서를 본다
    const sigAt = prompt.indexOf('design lives only inside');
    const motifAt = prompt.indexOf('Motifs to use');
    expect(sigAt).toBeGreaterThan(-1);
    expect(motifAt).toBeGreaterThan(-1);
    expect(sigAt).toBeLessThan(motifAt);
  });

  it('팔레트를 색 이름·역할·비율로 서술한다', () => {
    expect(prompt).toContain('milky nude');
    expect(prompt).toContain('60%');
    expect(prompt).toMatch(/ground colour|base/i);
  });

  it('모티프를 이름·재질·스케일로 서술한다', () => {
    expect(prompt).toContain('polka dot');
    expect(prompt).toContain('painted');
    expect(prompt).toContain('standard');
  });

  it('코어의 길이별 디자인 영역 규칙을 넣는다', () => {
    expect(prompt).toContain('30-45%');
  });

  it('코어 파츠 물리와 금지 항목을 넣는다', () => {
    expect(prompt).toContain('METAL PART PHYSICS');
    expect(prompt).toContain('marble veining');
  });

  it('공통분모 4줄을 모두 넣는다', () => {
    for (const rule of UNIVERSAL_RULES) expect(prompt).toContain(rule);
  });

  it('금지 어휘 charm·anchor를 쓰지 않는다', () => {
    expect(prompt).not.toMatch(/\bcharms?\b|\banchors?\b/i);
  });

  it('텍스처가 없는 코어는 질감 줄을 넣지 않는다', () => {
    expect(prompt).not.toContain('TEXTURE:');
  });

  it('레터링이 있으면 한 팁에 한 번만 쓰라고 지시한다', () => {
    const withLettering = buildCorePrompt({
      ...composeBrief(coquette, PHOTO, OPTS),
      letteringWord: 'Sugar',
    });
    expect(withLettering).toContain('"Sugar"');
    expect(withLettering).toContain('on one tip only');
  });

  it('빈 줄이 3줄 이상 연속되지 않는다', () => {
    expect(prompt).not.toMatch(/\n{3,}/);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/compose.test.ts`
Expected: FAIL — `composeBrief is not a function`

- [ ] **Step 3: `lib/compose.ts`에 조립기를 구현한다**

import를 고치고:

```ts
import type { LengthKey, NailCore } from './core';
import { UNIVERSAL_RULES } from './core';
import type { PhotoMotif, PhotoTake } from './photoTake';
import type { NailShape, PartsIntensity } from './types';
```

`selectMotifs` 아래에 추가:

```ts
/** 파츠에 해당하는 재질 — partsIntensity=none 처리에 사용 */
const PART_MATERIALS: ReadonlySet<PhotoMotif['material']> = new Set([
  'metal', 'pearl', 'sculpted',
]);

export interface CoreBrief {
  core: NailCore;
  photo: PhotoTake;
  shape: NailShape;
  length: LengthKey;
  /** 재질 보존 규칙을 통과한 사진 모티프 */
  motifs: PhotoMotif[];
  /** 변주 플랜이 주입하는 팁별 변주 서술. 기본은 빈 배열 */
  patternLines: string[];
  letteringWord: string | null;
}

export interface ComposeOptions {
  shape: NailShape;
  length: LengthKey;
  partsIntensity: PartsIntensity;
}

/**
 * 코어와 사진을 합친다. 코어 우선(D5) — 사진은 팔레트·모티프·무드만 기여한다.
 * 순수 함수 (입력 불변).
 */
export function composeBrief(
  core: NailCore,
  photo: PhotoTake,
  opts: ComposeOptions,
): CoreBrief {
  let motifs = selectMotifs(core, photo.motifs);
  if (opts.partsIntensity === 'none') {
    motifs = motifs.filter((m) => !PART_MATERIALS.has(m.material));
  }
  return {
    core,
    photo,
    shape: opts.shape,
    length: opts.length,
    motifs,
    patternLines: [],
    letteringWord: null,
  };
}

/** 팔레트 한 줄 — 색 이름 + 역할 + 비율. 모델은 hex보다 색 이름을 잘 이해한다 */
function paletteLine(photo: PhotoTake): string {
  const ROLE_WORDS: Record<PhotoTake['palette'][number]['role'], string> = {
    base: 'the ground colour every tip starts from',
    main: 'a colour the design is drawn in',
    accent: 'a small-quantity accent for lines, dots, and metal',
  };
  const parts = photo.palette.map(
    (p) => `${p.nameEn} (${p.hex}, ${Math.round(p.ratio * 100)}% of the surface — ${ROLE_WORDS[p.role]})`,
  );
  return `Palette: ${parts.join('; ')}.`;
}

/** 모티프 한 줄 — 이름 + 재질 + 스케일. 재질은 사진 것을 그대로 지킨다 (D7) */
function motifLine(motifs: PhotoMotif[]): string {
  if (motifs.length === 0) {
    return 'Motifs to use: none — the palette and finish carry the whole set.';
  }
  const SCALE_WORDS: Record<PhotoMotif['scale'], string> = {
    micro: 'micro scale, under 1mm',
    standard: 'standard scale',
    big: 'big scale, 3mm or more',
  };
  const parts = motifs.map((m) => `${m.name} rendered as ${m.material} at ${SCALE_WORDS[m.scale]}`);
  return `Motifs to use, each keeping exactly the material named here: ${parts.join('; ')}.`;
}

/**
 * 프롬프트 조립 — 스펙 6절의 9단 순서를 그대로 따른다.
 * 순서가 규범이다: 모델은 먼저 읽은 지시를 뼈대로 삼으므로 코어가 앞에 온다.
 */
export function buildCorePrompt(brief: CoreBrief): string {
  const { core, photo } = brief;

  const lines: string[] = [];

  // 1. 역할·산출물
  lines.push(
    'You are a top Korean nail artist presenting a design set.',
    `Create ONE photorealistic top-down flat-lay photo of a press-on nail tip sample board: individual ${brief.length} ${brief.shape} nail tips laid out in neat rows on a plain light-grey background, soft even studio lighting.`,
    '',
    'DESIGN BRIEF — follow every line exactly:',
  );

  // 2. 코어 구조
  lines.push(`- ${core.baseLine}`);
  lines.push(`- Structure: ${structureSentence(core)}`);
  lines.push(
    `- Negative space: ${Math.round(core.negativeSpace[0] * 100)}-${Math.round(core.negativeSpace[1] * 100)}% of each tip stays free of motifs.`,
  );
  lines.push(`- ${core.designZone[brief.length]}`);

  // 3. 코어 질감·마감
  if (core.textureGrammar.length > 0) {
    for (const t of core.textureGrammar) lines.push(`- TEXTURE: ${t}`);
  }
  lines.push(`- Finish: ${core.finishMix}`);

  // 4. 코어 시그니처
  for (const s of core.signature) lines.push(`- ${s}`);

  // 5. 사진 팔레트
  lines.push(`- ${paletteLine(photo)}`);

  // 6. 사진 모티프
  lines.push(`- ${motifLine(brief.motifs)}`);

  // 변주 플랜이 있으면 여기에 (팁별 변주는 모티프 다음)
  for (const p of brief.patternLines) lines.push(`- ${p}`);
  if (brief.letteringWord) {
    lines.push(
      `- Exactly one tip carries a single short cursive black script word "${brief.letteringWord}" — written once, on one tip only.`,
    );
  }

  // 7. 사용자 주문
  lines.push(
    `- Tip shape ${brief.shape}, length ${brief.length}. This is the client's order and it holds for every tip on the board.`,
  );

  // 8. 코어 파츠 물리
  lines.push(`- ${core.partsPhysics}`);
  lines.push(
    `- Parts budget for the whole set: ${core.partsBudget.big} statement part${core.partsBudget.big === 1 ? '' : 's'} plus ${core.partsBudget.studs[0]}-${core.partsBudget.studs[1]} small studs or beads in total.`,
  );

  // 9. 코어 금지 + 공통분모
  if (core.forbidden.length > 0) {
    lines.push(`- This set stays clear of: ${core.forbidden.join(', ')}.`);
  }
  for (const rule of UNIVERSAL_RULES) lines.push(`- ${rule}`);

  lines.push(`- Mood: ${photo.moodEn}`);
  lines.push(
    '- The tips are the only subject: plain background, clean composition, no text overlays, nothing else in frame.',
  );

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** 구조 enum → 영어 문장. 모델은 enum 토큰이 아니라 문장을 이해한다 */
function structureSentence(core: NailCore): string {
  const SENTENCES: Record<NailCore['structure'], string> = {
    'one-tone': 'each tip is one single colour edge to edge, with no boundary and no pattern',
    french: 'each tip has a french boundary near the free edge, with the design inside the tip zone',
    'deep-french':
      'each tip has a deep french boundary running a third to a half down the nail, with the design living only inside that tip zone and the zone above it left empty',
    'full-cover': 'the design covers the whole tip edge to edge, leaving no empty ground',
    'layered-sheer':
      'translucent colour is built up in layers across the whole tip, so depth comes from the stack rather than from any boundary line',
  };
  return SENTENCES[core.structure];
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/compose.test.ts`
Expected: PASS (17 tests)

- [ ] **Step 5: 타입 검사**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add lib/compose.ts tests/compose.test.ts
git commit -m "feat(compose): composeBrief·buildCorePrompt — 9단 조립 순서 구현

코어 구조·질감·시그니처가 사진 팔레트·모티프보다 먼저 오도록 순서를 고정.
순서가 곧 우선순위이므로 테스트로 인덱스 비교를 걸었다."
```

---

### Task 8: 코케트 등가성 체크리스트

새 경로가 옛 헌법의 하중 제약을 하나도 빠뜨리지 않았는지 검증한다. **단계 1의 합격 기준.**

**Files:**
- Test: `tests/coreEquivalence.test.ts`

**Interfaces:**
- Consumes: `buildCorePrompt`, `composeBrief` from `lib/compose.ts`; `coquette` from `config/cores/coquette.ts`; `buildBriefPrompt` from `lib/brief.ts`
- Produces: 없음

- [ ] **Step 1: 등가성 테스트를 쓴다**

`tests/coreEquivalence.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildCorePrompt, composeBrief } from '@/lib/compose';
import { coquette } from '@/config/cores/coquette';
import type { PhotoTake } from '@/lib/photoTake';

/**
 * 단계 1의 합격 기준 — 새 코케트 경로가 옛 프롬프트의 하중 제약을 모두 담는가.
 *
 * 문자열 완전 일치는 불가능하다: PhotoTake가 팔레트 표현을 바꿨고
 * (hex 3개 평면 → 색 이름 + 역할 + 비율), 구조 서술도 문장화됐다.
 * 그래서 "무엇이 반드시 프롬프트에 살아 있어야 하는가"를 목록으로 검증한다.
 * 옛 프롬프트 자체의 회귀는 tests/promptBaseline.test.ts가 따로 막는다.
 */
const PHOTO: PhotoTake = {
  palette: [
    { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
    { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
    { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
  ],
  motifs: [{ name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 }],
  moodKo: ['코케트'],
  moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
  tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
  fidelityAnchors: ['pastel polka dots'],
};

/** 옛 코케트 프롬프트가 담고 있던 하중 제약. 하나라도 빠지면 기준선이 무너진다 */
const LOAD_BEARING: Array<[string, RegExp]> = [
  ['시어 밀키 누드 베이스', /sheer milky nude/i],
  ['유리광 젤 마감', /high-gloss gel|glass-like/i],
  ['딥프렌치 구조', /deep french/i],
  ['디자인은 팁 영역 안에만', /only inside/i],
  ['누드 영역은 비워둠', /left empty|stays empty/i],
  ['길이별 디자인 영역 수치', /30-45%/],
  ['여백률 명시', /Negative space: 55-70%/],
  ['금속 파츠는 납작하게', /FLAT embossed metal stud/],
  ['파츠는 클리어 젤로 봉함', /sealed under a layer of clear gel/],
  ['파츠 예산 수치', /3-6 small studs/],
  // STYLE_ANALYSIS C절 역할 문법. 영어 anchor는 ⚓를 그리므로 코어는 focal tip이라 쓴다
  ['포컬·리듬·쉼표 세트 문법', /focal tip.*rhythm.*bare nude/is],
  ['재질 에코 (같은 모티프 다른 재질)', /returns in different materials/i],
  ['스마일라인 기본 경계', /smile line/i],
  ['손으로 만든 미세 편차', /micro-variations between tips/i],
  ['매달리는 파츠 배제', /hang, dangle, or swing/i],
  ['손톱 곡률보다 높은 파츠 배제', /taller than the nail curve/i],
  ['마블 배제', /marble veining/i],
  ['매트 배제', /matte finish/i],
  ['네온·비비드 배제', /neon or vivid/i],
  ['눈·얼굴 모티프 배제', /no eyes, eyeballs/i],
  ['팁만 피사체', /tips are the only subject/i],
  ['플랫레이 회색 배경', /plain light-grey background/i],
];

describe('코케트 등가성 — 새 경로가 옛 헌법을 모두 담는가', () => {
  const prompt = buildCorePrompt(
    composeBrief(coquette, PHOTO, { shape: 'almond', length: 'medium', partsIntensity: 'auto' }),
  );

  for (const [label, pattern] of LOAD_BEARING) {
    it(`하중 제약 유지: ${label}`, () => {
      expect(prompt, prompt).toMatch(pattern);
    });
  }

  it('사진 팔레트가 색 이름과 비율로 들어간다', () => {
    expect(prompt).toContain('milky nude (#efe0dc, 60%');
  });

  it('금지 어휘가 없다', () => {
    expect(prompt).not.toMatch(/\bcharms?\b|\banchors?\b/i);
  });

  it('한글이 섞이지 않는다 (moodEn만 영어로 들어감)', () => {
    expect(prompt).not.toMatch(/[가-힣]/);
  });
});
```

- [ ] **Step 2: 테스트를 실행한다**

Run: `npm test -- tests/coreEquivalence.test.ts`
Expected: 여기서 **실패가 나오는 항목이 곧 이식 누락**이다. 실패 목록을 보고 `config/cores/coquette.ts`의 `signature`·`forbidden` 문장을 보강한다.

실패가 나올 경우 대응 방법:
- 정규식이 찾는 표현이 코케트 코어 어디에도 없다면 → 해당 문장을 `signature` 또는 `forbidden`에 **추가**한다 (문장을 새로 창작하지 말고 `ref/trendy/STYLE_ANALYSIS.md`에서 근거를 찾아 옮긴다)
- 표현은 있는데 대소문자·어순이 달라 안 잡힌다면 → **정규식을 고친다** (코어 문장이 아니라 테스트를 맞춘다)

판단 기준: **하중 제약 자체가 빠진 것인가, 표현이 다른 것인가.** 빠진 것이면 코어를 고치고, 표현 차이면 테스트를 고친다.

- [ ] **Step 3: 실패 항목이 0이 될 때까지 코케트 코어 문장을 보강한다**

Run: `npm test -- tests/coreEquivalence.test.ts`
Expected: PASS (26 tests)

- [ ] **Step 4: 전체 테스트로 회귀가 없는지 확인한다**

Run: `npm test`
Expected: 전부 PASS — 특히 `tests/promptBaseline.test.ts` 스냅샷이 깨지지 않아야 한다 (기존 경로를 건드리지 않았으므로)

- [ ] **Step 5: 커밋**

```bash
# coquette.ts는 Step 3에서 보강했을 때만 포함된다
git add tests/coreEquivalence.test.ts
git add config/cores/coquette.ts 2>/dev/null || true
git commit -m "test(core): 코케트 등가성 체크리스트 — 옛 헌법 하중 제약 22개 검증

문자열 완전 일치는 불가능하므로(PhotoTake가 팔레트 표현을 바꿈)
반드시 살아 있어야 하는 제약 목록으로 검증한다."
```

---

### Task 9: 극단 3개 코어 작성

**Files:**
- Create: `config/cores/nuance.ts`
- Create: `config/cores/texture-gummy.ts`
- Create: `config/cores/decoden.ts`
- Modify: `config/cores/index.ts`
- Test: `tests/coreRegistry.test.ts` (기존 순회 테스트가 자동 적용)

**Interfaces:**
- Consumes: `NailCore` from `lib/core.ts`
- Produces: `const nuance`, `const textureGummy`, `const decoden` — 모두 `NailCore`

- [ ] **Step 1: `config/cores/nuance.ts`를 만든다**

```ts
import type { NailCore } from '@/lib/core';

/**
 * 뉘앙스 코어 — 2026년 1순위 트렌드. 일본·한국 발원.
 * 도쿄 네일 엑스포에서 본 것의 85%가 이것이었다는 증언 (스펙 2-1절).
 * 핵심은 "겹쳐서 생기는 깊이" — 경계선이 없고, 색이 층으로 쌓인다.
 */
export const nuance: NailCore = {
  id: 'nuance',
  nameKo: '뉘앙스',
  taglineKo: '광물을 캐낸 단면',
  noise: 2,

  baseLine:
    'Base of every tip: sheer translucent colour built up in several layers, so looking at the tip feels like looking into a cross-section of polished mineral.',
  structure: 'layered-sheer',
  negativeSpace: [0.2, 0.4],
  designZone: {
    short:
      'Length rule (short tips): the layered colour spreads across the whole tip with no boundary line; keep the number of layers to two or three so the small surface stays readable.',
    medium:
      'Length rule (medium tips): the layered colour spreads across the whole tip with no boundary line; three or four layers of sheer colour build the depth.',
    long:
      'Length rule (long tips): the layered colour runs the full length of the tip with no boundary line; four or more layers, and the swirl can travel from cuticle to free edge.',
  },

  textureGrammar: [
    'Sheer jelly and milky colours are layered over a magnetic cat-eye base, so one soft light streak moves underneath the translucent layers.',
    'Soft swirls are dragged through the wet sheer layers, their edges blurring into one another with no hard line anywhere.',
    'Fine chrome lines trace a few of the swirl boundaries, catching light like a mineral vein.',
  ],
  finishMix:
    'One high-gloss finish over the whole set; the depth comes from the layers underneath rather than from the top coat.',

  partsPhysics:
    'PART PHYSICS: any part is a tiny flat metal bead lying flush ON the surface, sealed under clear gel so it reads as one of the layers rather than an object added on top.',
  partsBudget: { big: 0, studs: [0, 2] },
  allowedMaterials: ['painted', 'chrome', 'metal'],
  motifBudget: 2,

  signature: [
    'Every tip is a different draw from the same mineral: the same colours layered in a different order, so no two tips repeat.',
    'Colour boundaries are always soft — where two colours meet they bleed into each other over a millimetre or more.',
    'One or two tips carry a fine chrome vein tracing the edge of a swirl, and nothing else.',
    'Earth-and-water colours dominate: forest green, warm brown, deep-sea blue, smoky amethyst.',
  ],

  forbidden: [
    'hard-edged geometric motifs',
    'opaque flat colour blocking',
    'a french boundary line',
    'crisp outlines around shapes',
    'glitter particles',
  ],

  variantOps: ['palette-rotate', 'layer-depth', 'swirl-direction', 'density', 'chrome-accent'],
  attachPhoto: false,

  judge: { minPartsTips: 0, maxPartsTips: 2, allowGelVolume: false, minNegativeSpace: 0.2 },
};
```

- [ ] **Step 2: `config/cores/texture-gummy.ts`를 만든다**

```ts
import type { NailCore } from '@/lib/core';

/**
 * 텍스처·구미 코어 — Pinterest `3D gummy nails` 검색 +180% (스펙 2-1절).
 * 데코덴과의 결정적 차이: 파츠를 거의 쓰지 않고 질감만으로 시끄럽게 만든다.
 * 조사에서 확인된 대중 수요 지점 — "풀 장식은 망설이지만 텍스처는 원한다".
 */
export const textureGummy: NailCore = {
  id: 'texture-gummy',
  nameKo: '텍스처·구미',
  taglineKo: '파츠 없이 질감으로',
  noise: 4,

  baseLine:
    'Base of every tip: semi-sheer jelly colour with a thick chewy depth, like a gummy sweet lit from behind.',
  structure: 'full-cover',
  negativeSpace: [0.1, 0.3],
  designZone: {
    short:
      'Length rule (short tips): the raised texture covers the whole tip; keep each raised element small and closely spaced so the relief reads at this size.',
    medium:
      'Length rule (medium tips): the raised texture covers the whole tip, with the relief pattern repeating three to five times across the surface.',
    long:
      'Length rule (long tips): the raised texture covers the whole tip and the relief pattern can run the full length, with larger single forms welcome.',
  },

  textureGrammar: [
    'Raised gel relief is drawn as a repeating pattern — cable-knit ribs, quilted diamonds, or rolling waves — standing one to two millimetres proud of the base and reading by its own shadow.',
    'Blooming gel lets colour spread outward inside a clear layer, so the bloom on each tip comes out slightly different from the last.',
    'Domed clear gel droplets sit on top of the finished colour like water beads, each one holding a small highlight.',
  ],
  finishMix:
    'Mix finishes deliberately across the set: a matte base carrying glossy raised relief on top, one tip in cat-eye velvet, one tip in mirror chrome. Never the same finish on every tip.',

  partsPhysics:
    // "anchor" 어근을 피한다 — ⚓를 그린 실측이 있다 (ref/PARTS_ANALYSIS.md 5-1절)
    'PART PHYSICS: volume here is made of gel, not of attached parts — every raised form is gel shaped by hand before curing, held to the tip by a visible gel fillet at its base and sealed with a thin clear layer.',
  partsBudget: { big: 0, studs: [0, 2] },
  allowedMaterials: ['painted', 'gel-volume', 'chrome'],
  motifBudget: 2,

  signature: [
    'The set is a study in touch: you should be able to guess how each tip would feel under a fingertip.',
    'One tip is smooth and glossy, sitting next to a tip in deep relief — the contrast is what makes both read.',
    'Colour stays semi-sheer so light travels into the gel and comes back out, keeping the jelly depth alive.',
    'Every raised form is tone-on-tone or a half-step off the base colour, so shape carries the design rather than colour contrast.',
  ],

  forbidden: [
    'a single uniform finish across the set',
    'attached metal parts as the main event',
    'flat painted-only tips',
    'opaque chalky colour',
  ],

  variantOps: ['relief-pattern-swap', 'finish-remix', 'bloom-density', 'palette-rotate', 'rescale'],
  attachPhoto: false,

  judge: { minPartsTips: 0, maxPartsTips: 2, allowGelVolume: true, minNegativeSpace: 0.1 },
};
```

- [ ] **Step 3: `config/cores/decoden.ts`를 만든다**

```ts
import type { NailCore } from '@/lib/core';

/**
 * 데코덴·갸루 코어 — 전역 강제 규칙 전부의 반대편.
 * 참조: ref/trendy/IMG_6259.jpg (Vickeenails). 여백 0, 파츠 5+, 조소 볼륨.
 * 이 코어가 통과하면 조립기가 스타일 스펙트럼 전체를 커버한다는 뜻이다.
 */
export const decoden: NailCore = {
  id: 'decoden',
  nameKo: '데코덴·갸루',
  taglineKo: '손톱을 조형물로',
  noise: 5,

  baseLine:
    'Base of every tip: opaque milky white or sheer pink covered edge to edge — the base is a canvas to build on, not empty space to protect.',
  structure: 'full-cover',
  negativeSpace: [0, 0.15],
  designZone: {
    short:
      'Length rule (short tips): the build covers 85-100% of each tip; keep each sculpted form compact and low so the tip stays wearable at this length.',
    medium:
      'Length rule (medium tips): the build covers 85-100% of each tip, with one sculpted form rising as the centrepiece.',
    long:
      'Length rule (long tips): the build covers the whole tip and the long surface carries the largest sculpted forms, script lettering, and dense clusters together.',
  },

  textureGrammar: [
    'Sculpted gel relief rises one to three millimetres above the tip, hand-shaped before curing so each curve holds a highlight.',
    'Tone-on-tone embossed baroque scrollwork covers a tip in the same colour as its base, readable only by the shadows it casts.',
    'Domed clear gel droplets sit over finished art like beads of water caught on a surface.',
  ],
  finishMix:
    'Mix finishes across the set: several tips in high gloss, one tip in mirror chrome polished like liquid metal, one tip matte with glossy raised relief standing on it.',

  partsPhysics:
    // "anchor" 어근을 피한다 — ⚓를 그린 실측이 있다 (ref/PARTS_ANALYSIS.md 5-1절)
    'PART PHYSICS: parts are built UP in volume — sculpted gel flowers with individually shaped petals, domed pearls in graded sizes, cast metal ornaments with clean closed outlines. Each part is held by a visible gel fillet where it meets the tip and sealed with a thin clear layer over its base. The volume rises off the surface while the silhouette stays inside the tip outline.',
  partsBudget: { big: 3, studs: [6, 12] },
  allowedMaterials: ['painted', 'gel-volume', 'metal', 'pearl', 'chrome', 'sculpted'],
  motifBudget: 4,

  signature: [
    'One focal tip carries a sculpted lily or rose whose petals are shaped one at a time and rise clear of the surface.',
    'One or two tips are covered in sculpted white baroque scrollwork, raised in tone-on-tone white so shadow alone draws the pattern.',
    'One tip is packed with a cluster of three to six domed pearls in graded sizes, sitting shoulder to shoulder, each sealed under clear gel.',
    'One tip is finished in mirror chrome, polished until it reads as liquid metal.',
    'Density is the point: a tip that looks unfinished breaks the set.',
  ],

  forbidden: [
    'bare negative space left as a design choice',
    'flat decoration only',
    'a single uniform finish across the set',
    'timid single-bead accents as the main event',
  ],

  variantOps: ['material-swap', 'volume-up', 'cluster-density', 'palette-rotate', 'motif-swap'],
  attachPhoto: false,

  judge: { minPartsTips: 4, maxPartsTips: 10, allowGelVolume: true, minNegativeSpace: 0 },
};
```

- [ ] **Step 4: `config/cores/index.ts`에 등록한다**

```ts
import type { NailCore } from '@/lib/core';
import { coquette } from './coquette';
import { decoden } from './decoden';
import { nuance } from './nuance';
import { textureGummy } from './texture-gummy';

/**
 * 등록된 코어. 배열 순서는 무의미하며, UI 정렬은 noise 오름차순으로 계산한다.
 * 스펙 2-2절의 15종 중 단계 1~3 범위인 4종만 우선 등록.
 */
export const CORES: NailCore[] = [nuance, coquette, textureGummy, decoden];
```

- [ ] **Step 5: 레지스트리 순회 테스트가 3개 코어에도 통과하는지 확인한다**

Run: `npm test -- tests/coreRegistry.test.ts`
Expected: PASS — 특히 금지 어휘·한글 혼입·범위 불변식이 새 코어 3개에도 적용된다

- [ ] **Step 6: 데코덴이 코케트와 실제로 다른 프롬프트를 내는지 확인하는 테스트를 추가한다**

`tests/coreEquivalence.test.ts` 맨 아래에 붙인다:

```ts
import { decoden } from '@/config/cores/decoden';
import { nuance } from '@/config/cores/nuance';
import { textureGummy } from '@/config/cores/texture-gummy';

describe('코어별 프롬프트 분기 — 같은 사진에서 다른 지시가 나온다', () => {
  const opts = { shape: 'almond' as const, length: 'medium' as const, partsIntensity: 'auto' as const };
  const build = (core: typeof coquette) => buildCorePrompt(composeBrief(core, PHOTO, opts));

  it('데코덴은 여백을 0-15%로, 코케트는 55-70%로 지시한다', () => {
    expect(build(decoden)).toContain('Negative space: 0-15%');
    expect(build(coquette)).toContain('Negative space: 55-70%');
  });

  it('데코덴은 볼륨을 쌓으라 하고, 코케트는 납작하게 붙이라 한다', () => {
    expect(build(decoden)).toContain('built UP in volume');
    expect(build(coquette)).toContain('FLAT embossed metal stud');
  });

  it('데코덴·텍스처는 마감 믹싱을 요구하고, 코케트는 단일 마감을 요구한다', () => {
    expect(build(decoden)).toMatch(/Never the same finish|Mix finishes/);
    expect(build(textureGummy)).toMatch(/Never the same finish|Mix finishes/);
    expect(build(coquette)).toContain('One single finish');
  });

  it('뉘앙스는 프렌치 경계선을 배제한다', () => {
    expect(build(nuance)).toContain('a french boundary line');
    expect(build(nuance)).toContain('no boundary line');
  });

  it('텍스처·구미는 질감 줄을 넣고, 코케트는 넣지 않는다', () => {
    expect(build(textureGummy)).toContain('TEXTURE:');
    expect(build(coquette)).not.toContain('TEXTURE:');
  });

  it('4개 코어의 프롬프트는 서로 모두 다르다', () => {
    const prompts = [coquette, nuance, textureGummy, decoden].map(build);
    expect(new Set(prompts).size).toBe(4);
  });
});
```

- [ ] **Step 7: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/coreEquivalence.test.ts`
Expected: PASS

- [ ] **Step 8: 전체 테스트 + 타입 검사**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS, 타입 에러 없음

- [ ] **Step 9: 커밋**

```bash
git add config/cores/nuance.ts config/cores/texture-gummy.ts config/cores/decoden.ts config/cores/index.ts tests/coreEquivalence.test.ts
git commit -m "feat(core): 극단 3개 코어 추가 — 뉘앙스·텍스처구미·데코덴

코케트에서 가장 먼 3개를 먼저 넣어 조립기가 스펙트럼 전체를 커버하는지 검증.
같은 사진에서 4개 코어가 서로 다른 프롬프트를 내는 것을 테스트로 고정."
```

---

### Task 10: judge 코어 기반 판정

**Files:**
- Modify: `lib/judge.ts`
- Test: `tests/judgeCore.test.ts`

**Interfaces:**
- Consumes: `NailCore` from `lib/core.ts`, `NailJudgement` from `lib/judge.ts` (기존)
- Produces:
  - `interface CoreJudgement extends NailJudgement { paletteFidelity: boolean; motifFidelity: number; coreFidelity: boolean }`
  - `function coreExpectedParts(core: NailCore): { min: number; max: number }`
  - `function verdictForCore(j: CoreJudgement, core: NailCore, anchorCount: number): { pass: boolean; score: number }`

기존 `verdict`·`expectedMetalTips`는 **그대로 남긴다** (기존 variant 경로가 사용 중).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/judgeCore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { coreExpectedParts, verdictForCore } from '@/lib/judge';
import type { CoreJudgement } from '@/lib/judge';
import { coquette } from '@/config/cores/coquette';
import { decoden } from '@/config/cores/decoden';

const CLEAN: CoreJudgement = {
  baseMatch: true,
  paletteMatch: true,
  partsMatch: true,
  metalTipCount: 1,
  letteringCount: 0,
  physicsOk: true,
  cleanRender: true,
  notes: '',
  paletteFidelity: true,
  motifFidelity: 2,
  coreFidelity: true,
};

describe('coreExpectedParts', () => {
  it('코어 judge 값을 그대로 읽는다 (문자열 파싱 없음)', () => {
    expect(coreExpectedParts(coquette)).toEqual({ min: 1, max: 2 });
    expect(coreExpectedParts(decoden)).toEqual({ min: 4, max: 10 });
  });
});

describe('verdictForCore', () => {
  it('전부 충족하면 통과, 만점', () => {
    const v = verdictForCore(CLEAN, coquette, 2);
    expect(v.pass).toBe(true);
    expect(v.score).toBe(8);
  });

  it('파츠 개수가 코어 범위를 벗어나면 탈락', () => {
    const v = verdictForCore({ ...CLEAN, metalTipCount: 7 }, coquette, 2);
    expect(v.pass).toBe(false);
  });

  it('같은 파츠 개수가 데코덴에서는 통과한다', () => {
    const v = verdictForCore({ ...CLEAN, metalTipCount: 7 }, decoden, 2);
    expect(v.pass).toBe(true);
  });

  it('물리 위반은 즉시 탈락', () => {
    expect(verdictForCore({ ...CLEAN, physicsOk: false }, coquette, 2).pass).toBe(false);
  });

  it('AI 티는 즉시 탈락', () => {
    expect(verdictForCore({ ...CLEAN, cleanRender: false }, coquette, 2).pass).toBe(false);
  });

  it('코어 충실도 실패는 점수만 깎고 탈락시키지 않는다 (D8)', () => {
    const v = verdictForCore({ ...CLEAN, coreFidelity: false }, coquette, 2);
    expect(v.pass).toBe(true);
    expect(v.score).toBe(7);
  });

  it('모티프 충실도는 앵커 개수 대비로 점수에 반영된다', () => {
    const full = verdictForCore(CLEAN, coquette, 2);
    const half = verdictForCore({ ...CLEAN, motifFidelity: 0 }, coquette, 2);
    expect(half.score).toBeLessThan(full.score);
  });

  it('앵커가 0개면 모티프 충실도는 만족으로 본다', () => {
    const v = verdictForCore({ ...CLEAN, motifFidelity: 0 }, coquette, 0);
    expect(v.score).toBe(8);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/judgeCore.test.ts`
Expected: FAIL — `coreExpectedParts is not exported`

- [ ] **Step 3: `lib/judge.ts` 맨 아래에 코어 기반 판정을 추가한다**

파일 상단 import에 추가:

```ts
import type { NailCore } from './core';
```

파일 맨 아래에 추가:

```ts
/* ------------------------------------------------------------------ */
/* 코어 기반 판정 (스펙 6절) — 기존 verdict은 옛 경로용으로 남겨둔다      */
/* ------------------------------------------------------------------ */

/** 원본 대비 충실도 3항목을 더한 검수 결과 */
export interface CoreJudgement extends NailJudgement {
  /** 추출 팔레트의 역할·비율이 지켜졌나 */
  paletteFidelity: boolean;
  /** fidelityAnchors 중 살아있는 개수 */
  motifFidelity: number;
  /** 선택한 코어의 정체성(여백률·질감·파츠 밀도)이 드러나나 */
  coreFidelity: boolean;
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
 * 코어 기준 판정. 즉시 탈락은 3종만 — 물리 위반·AI 티·파츠 개수 위반.
 * 충실도 3항목(palette/motif/core)은 D8에 따라 점수만 기록하고 탈락시키지 않는다.
 */
export function verdictForCore(
  j: CoreJudgement,
  core: NailCore,
  anchorCount: number,
): { pass: boolean; score: number } {
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
  const score = checks.filter(Boolean).length;

  const pass = j.physicsOk && j.cleanRender && partsOk;
  return { pass, score };
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/judgeCore.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 기존 judge 테스트가 깨지지 않았는지 확인한다**

Run: `npm test -- tests/judge.test.ts`
Expected: PASS (기존 `verdict`·`expectedMetalTips`를 건드리지 않았으므로)

- [ ] **Step 6: 커밋**

```bash
git add lib/judge.ts tests/judgeCore.test.ts
git commit -m "feat(judge): 코어 기반 판정 추가 — 파츠 개수를 코어에서 직접 읽는다

partsLine 정규식 추정 대신 core.judge 숫자를 읽는다.
충실도 3항목은 점수만 기록하고 탈락 게이트로 쓰지 않는다 (재생성 없음)."
```

---

### Task 11: 코어별 변주 플랜

**Files:**
- Modify: `lib/brief.ts`
- Test: `tests/variantCore.test.ts`

**Interfaces:**
- Consumes: `NailCore` from `lib/core.ts`
- Produces: `function fallbackPlansForCore(core: NailCore): VariantPlan[]`

기존 `fallbackPlans(brief)`는 **그대로 남긴다**.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`tests/variantCore.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { fallbackPlansForCore } from '@/lib/brief';
import { coquette } from '@/config/cores/coquette';
import { decoden } from '@/config/cores/decoden';
import { nuance } from '@/config/cores/nuance';

describe('fallbackPlansForCore', () => {
  it('코어마다 5개 플랜을 낸다', () => {
    for (const core of [coquette, decoden, nuance]) {
      const plans = fallbackPlansForCore(core);
      expect(plans, core.id).toHaveLength(5);
      expect(plans.map((p) => p.id)).toEqual(['v1', 'v2', 'v3', 'v4', 'v5']);
    }
  });

  it('코케트에는 파츠 제로 변주가 있다', () => {
    const plans = fallbackPlansForCore(coquette);
    expect(plans.some((p) => p.partsLine.includes('painted gel only'))).toBe(true);
  });

  it('데코덴에는 파츠 제로 변주가 없다 — 정체성 파괴', () => {
    const plans = fallbackPlansForCore(decoden);
    expect(plans.every((p) => !p.partsLine.includes('Every tip is painted gel only'))).toBe(true);
  });

  it('뉘앙스에는 경계선 변주가 없다 — 경계선 자체를 배제하는 코어', () => {
    const plans = fallbackPlansForCore(nuance);
    const all = plans.flatMap((p) => p.patternLines).join(' ');
    expect(all).not.toMatch(/french boundary|smile line|diagonal boundary/i);
  });

  it('플랜 제목은 한국어', () => {
    for (const p of fallbackPlansForCore(decoden)) {
      expect(p.title).toMatch(/[가-힣]/);
    }
  });

  it('플랜 서술은 영어이고 금지 어휘가 없다', () => {
    for (const core of [coquette, decoden, nuance]) {
      const all = fallbackPlansForCore(core)
        .flatMap((p) => [...p.patternLines, p.partsLine])
        .join(' ');
      expect(all, core.id).not.toMatch(/[가-힣]/);
      expect(all, core.id).not.toMatch(/\bcharms?\b|\banchors?\b/i);
    }
  });

  it('다섯 플랜의 패턴 서술은 서로 다르다', () => {
    const plans = fallbackPlansForCore(decoden);
    const joined = plans.map((p) => p.patternLines.join('|'));
    expect(new Set(joined).size).toBe(5);
  });
});
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

Run: `npm test -- tests/variantCore.test.ts`
Expected: FAIL — `fallbackPlansForCore is not exported`

- [ ] **Step 3: `lib/brief.ts` 맨 아래에 코어별 변주를 추가한다**

파일 상단 import에 추가:

```ts
import type { NailCore } from './core';
```

파일 맨 아래에 추가:

```ts
/* ------------------------------------------------------------------ */
/* 코어별 변주 플랜 — 연산자가 코어 정체성을 깨지 않도록 분리            */
/* ------------------------------------------------------------------ */

/**
 * 변주 연산자 → 생성 지시 문장. 코어의 variantOps에 나열된 것만 사용된다.
 * 예: zero-parts는 코케트에는 좋은 변주지만 데코덴에서는 정체성 파괴이므로
 * 데코덴의 variantOps에 들어 있지 않다.
 */
const VARIANT_OP_LINES: Record<string, { titleKo: string; line: string; zeroParts?: boolean }> = {
  invert: {
    titleKo: '컬러 반전',
    line: 'Invert figure and ground on every tip: paint each motif in the former background colour and each background in the former motif colour, keeping the same shapes and placement.',
  },
  rescale: {
    titleKo: '마이크로 스케일',
    line: 'Shrink every motif to micro scale: dots at 0.5-1mm diameter, lines at 0.5mm thickness, keeping the same layout and rhythm.',
  },
  density: {
    titleKo: '밀도 변주',
    line: 'Change the density across the set: one tip packed edge to edge, one tip sparse with wide breathing room, and a shrinking trail between them.',
  },
  'zero-parts': {
    titleKo: '핸드페인트 온리',
    line: 'Every motif on every tip is hand-painted with a brush, so the whole set reads as paint and gel alone.',
    zeroParts: true,
  },
  'boundary-swap': {
    titleKo: '사선 프렌치',
    line: 'Redraw every tip boundary as one clean straight diagonal running from the lower left to the upper right, with the design fully contained inside the diagonal tip zone.',
  },
  'material-swap': {
    titleKo: '재질 교체',
    line: 'Repeat the same motif in a different material on each tip: painted on one, raised tone-on-tone gel on another, cast metal on a third, domed pearl on a fourth.',
  },
  'volume-up': {
    titleKo: '볼륨 업',
    line: 'Build every raised form one step taller and rounder, so each sculpted element carries a broader highlight and casts a longer shadow.',
  },
  'cluster-density': {
    titleKo: '클러스터 밀집',
    line: 'Gather the small parts into tight clusters instead of spreading them: one tip holds a dense packed group, its neighbour holds a single graded line of the same parts.',
  },
  'palette-rotate': {
    titleKo: '팔레트 회전',
    line: 'Keep every shape and placement identical and rotate which colour goes where, so each tip wears a different member of the same palette.',
  },
  'motif-swap': {
    titleKo: '모티프 교체',
    line: 'Swap the sculpted centrepiece for a different botanical form of the same size and build: a rose becomes a lily, a lily becomes a peony.',
  },
  'layer-depth': {
    titleKo: '레이어 심도',
    line: 'Vary how many sheer layers each tip carries, from two on the shallowest to five on the deepest, so the depth reads differently tip to tip.',
  },
  'swirl-direction': {
    titleKo: '스월 방향',
    line: 'Turn the direction each swirl travels: one tip drifts lengthwise, the next diagonally, the next in a slow spiral, all with edges bleeding softly.',
  },
  'chrome-accent': {
    titleKo: '크롬 베인',
    line: 'Move the fine chrome vein to a different boundary on each tip, and leave two tips with no chrome at all.',
  },
  'relief-pattern-swap': {
    titleKo: '릴리프 교체',
    line: 'Give each tip a different raised relief pattern at the same height: cable-knit ribs, quilted diamonds, rolling waves, and a plain smooth tip for contrast.',
  },
  'finish-remix': {
    titleKo: '마감 리믹스',
    line: 'Reassign the finishes across the set so a different tip carries the matte, the cat-eye velvet, and the mirror chrome than before.',
  },
  'bloom-density': {
    titleKo: '블룸 밀도',
    line: 'Vary how far the blooming colour spreads inside the clear layer: tight compact blooms on one tip, wide diffuse blooms on another.',
  },
};

/** 코어의 파츠 예산을 명시 문장으로 — judge가 숫자를 셀 수 있는 형태 */
function corePartsLine(core: NailCore): string {
  const [lo, hi] = core.partsBudget.studs;
  if (core.partsBudget.big === 0 && hi === 0) return ZERO_PARTS_LINE;
  const bigPart =
    core.partsBudget.big > 0
      ? `Exactly ${numberWord(core.partsBudget.big)} tip${core.partsBudget.big === 1 ? '' : 's'} carr${core.partsBudget.big === 1 ? 'ies' : 'y'} a statement part as its centrepiece. `
      : '';
  return `${bigPart}Across the rest of the set ${lo}-${hi} small studs, beads, or pearls are placed in total, and every remaining tip is painted gel only.`;
}

function numberWord(n: number): string {
  return ['zero', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);
}

/**
 * 코어별 결정적 폴백 플랜 5종 — LLM 없이 코드로 생성.
 * 코어의 variantOps 순서대로 5개를 뽑고, 부족하면 팔레트 회전으로 채운다.
 */
export function fallbackPlansForCore(core: NailCore): VariantPlan[] {
  const ops = [...core.variantOps];
  while (ops.length < 5) ops.push('palette-rotate');

  return ops.slice(0, 5).map((op, i) => {
    const spec = VARIANT_OP_LINES[op] ?? VARIANT_OP_LINES['palette-rotate'];
    return {
      id: `v${i + 1}`,
      title: spec.titleKo,
      patternLines: [spec.line],
      partsLine: spec.zeroParts ? ZERO_PARTS_LINE : corePartsLine(core),
      letteringWord: null,
    };
  });
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npm test -- tests/variantCore.test.ts`
Expected: PASS (7 tests)

주의: `'다섯 플랜의 패턴 서술은 서로 다르다'` 가 실패하면 해당 코어의 `variantOps` 5개가 서로 다른 값인지 확인한다 (중복이면 같은 문장이 나온다).

- [ ] **Step 5: 전체 테스트 + 타입 검사**

Run: `npm test && npm run typecheck`
Expected: 전부 PASS

- [ ] **Step 6: 커밋**

```bash
git add lib/brief.ts tests/variantCore.test.ts
git commit -m "feat(brief): 코어별 변주 플랜 — 연산자를 코어가 소유한다

파츠 제로 변주는 코케트에만, 경계선 변주는 뉘앙스에서 제외.
연산자 16종을 문장 테이블로 두고 코어의 variantOps가 골라 쓴다."
```

---

### Task 12: 실측 스크립트 + 3단계 실행

**Files:**
- Create: `scripts/generate-core-candidates.mts`

**Interfaces:**
- Consumes: `getCore`, `extractPhotoTake`, `composeBrief`, `buildCorePrompt`, `fallbackPlansForCore`, `generateImage`
- Produces: `ref/results/core-candidates/<coreId>/` 아래 이미지 + `manifest.json` + `REPORT.md`

- [ ] **Step 1: 스크립트를 쓴다**

`scripts/generate-core-candidates.mts`:

```ts
/**
 * 코어 실측 — 코어별로 팁셋 후보를 뽑아 헌법이 작동하는지 눈으로 확인한다.
 *
 * 사용법:
 *   npx tsx scripts/generate-core-candidates.mts <사진경로> <코어id...> [--attach] [--n=3]
 * 예:
 *   npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --n=3
 *   npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --attach --n=3
 *
 * 합격 기준(스펙 8절 3단계): 코어당 n장 중 1장이라도 "이 코어답다"가 나오면 통과.
 * 그 컷이 UI 카드용 샘플 이미지가 된다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_ROOT = 'ref/results/core-candidates';

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));

  const [photoPath, ...coreIds] = positional;
  if (!photoPath || coreIds.length === 0) {
    console.error('사용법: npx tsx scripts/generate-core-candidates.mts <사진경로> <코어id...> [--attach] [--n=3]');
    process.exit(1);
  }

  const attach = flags.includes('--attach');
  const nFlag = flags.find((f) => f.startsWith('--n='));
  const count = nFlag ? Number(nFlag.slice(4)) : 3;

  const { getCore } = await import('../lib/core');
  const { extractPhotoTake } = await import('../lib/photoTake');
  const { composeBrief, buildCorePrompt } = await import('../lib/compose');
  const { fallbackPlansForCore } = await import('../lib/brief');
  const { generateImage } = await import('../lib/provider');

  const buffer = await readFile(photoPath);
  const mimeType = photoPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const photoPayload = { data: buffer.toString('base64'), mimeType };

  console.log(`사진 분석 중: ${photoPath}`);
  const take = await extractPhotoTake([photoPayload]);
  if (!take) {
    console.error('사진 분석 실패 — GEMINI_API_KEY를 확인하세요.');
    process.exit(1);
  }
  console.log(`  팔레트: ${take.palette.map((p) => `${p.nameEn} ${Math.round(p.ratio * 100)}%`).join(', ')}`);
  console.log(`  모티프: ${take.motifs.map((m) => `${m.name}(${m.material})`).join(', ') || '없음'}`);
  console.log(`  앵커: ${take.fidelityAnchors.join(' / ')}`);

  for (const coreId of coreIds) {
    const core = getCore(coreId);
    if (!core) {
      console.error(`코어 없음: ${coreId}`);
      continue;
    }

    const suffix = attach ? 'attach' : 'noattach';
    const outDir = path.join(OUT_ROOT, `${coreId}-${suffix}`);
    await mkdir(outDir, { recursive: true });

    const plans = fallbackPlansForCore(core);
    const records: Array<{ file: string; planId: string; planTitle: string; prompt: string }> = [];

    console.log(`\n[${core.nameKo}] ${count}장 생성 (사진첨부: ${attach ? 'O' : 'X'})`);

    for (let i = 0; i < count; i++) {
      const plan = plans[i % plans.length];
      const brief = {
        ...composeBrief(core, take, { shape: 'almond', length: 'medium', partsIntensity: 'auto' }),
        patternLines: plan.patternLines,
        letteringWord: plan.letteringWord,
      };
      const prompt = buildCorePrompt(brief);

      // D6 실측 — attachPhoto 플래그에 따라 원본 첨부 여부를 바꾼다
      const refs = attach ? [photoPayload] : [];
      const outcome = await generateImage(refs, prompt);

      if (!outcome.image) {
        console.log(`  ${i + 1}/${count} 실패 (safetyBlocked=${outcome.safetyBlocked})`);
        continue;
      }
      const file = `${coreId}-${suffix}-${String(i + 1).padStart(2, '0')}.png`;
      await writeFile(path.join(outDir, file), Buffer.from(outcome.image.data, 'base64'));
      records.push({ file, planId: plan.id, planTitle: plan.title, prompt });
      console.log(`  ${i + 1}/${count} → ${file} (${plan.title})`);
    }

    await writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify({ coreId, attach, photoPath, photoTake: take, records }, null, 2),
    );

    const report = [
      `# ${core.nameKo} 실측 (사진첨부: ${attach ? 'O' : 'X'})`,
      '',
      `- 원본 사진: \`${photoPath}\``,
      `- 생성 ${records.length}/${count}장`,
      `- 합격 기준: 1장이라도 "이 코어답다"가 나오면 통과`,
      '',
      '## 판정',
      '',
      '| 파일 | 변주 | 코어다움 | 메모 |',
      '|---|---|---|---|',
      ...records.map((r) => `| ${r.file} | ${r.planTitle} | ⬜ | |`),
      '',
      '## 프롬프트 (1번)',
      '',
      '```',
      records[0]?.prompt ?? '(생성 없음)',
      '```',
    ].join('\n');
    await writeFile(path.join(outDir, 'REPORT.md'), report);
    console.log(`  리포트: ${path.join(outDir, 'REPORT.md')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: 목 모드로 스크립트가 도는지 확인한다 (과금 없음)**

Run: `GEMINI_MOCK=1 npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --n=1`
Expected: 사진 분석 로그가 나오고, 생성은 실패하거나(목 provider 없음) 프롬프트까지 조립됨. **여기서 확인할 것은 `extractPhotoTake` → `composeBrief` → `buildCorePrompt` 경로가 예외 없이 끝까지 도는지**다.

만약 `generateImage`가 목 모드를 지원하지 않아 예외가 나면, `lib/gemini.ts`에 이미 `GEMINI_MOCK` 처리가 있는지 확인하고 없으면 스크립트가 프롬프트만 출력하도록 `--dry` 플래그를 추가한다:

```ts
  const dry = flags.includes('--dry');
  // ... 생성 직전
      if (dry) {
        console.log(prompt);
        continue;
      }
```

- [ ] **Step 3: 커밋**

```bash
git add scripts/generate-core-candidates.mts
git commit -m "feat(scripts): 코어 실측 스크립트 — 코어별 후보 생성 + 첨부 A/B

사진 1장 → PhotoTake → 코어별 프롬프트 → 이미지 n장 + 판정 리포트."
```

- [ ] **Step 4: 실제 실측을 돌린다 — 데코덴 (첨부 X)**

Run: `npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --n=3`
Expected: `ref/results/core-candidates/decoden-noattach/` 에 이미지 3장 + `REPORT.md`

- [ ] **Step 5: 실제 실측을 돌린다 — 데코덴 (첨부 O)**

Run: `npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --attach --n=3`
Expected: `ref/results/core-candidates/decoden-attach/` 에 이미지 3장

- [ ] **Step 6: 뉘앙스·텍스처구미도 같은 방식으로 돌린다**

Run:
```bash
npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg nuance texture-gummy --n=3
npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg nuance texture-gummy --attach --n=3
```
Expected: 4개 디렉터리 추가 (총 18장)

- [ ] **Step 7: 결과를 사람이 확인하고 판정을 기록한다**

각 `REPORT.md`의 판정 표에 ⬜ → ✅/❌를 채운다. 확인 항목:
- **데코덴**: 여백이 거의 없는가 / 조소 볼륨이 올라갔는가 / 마감이 섞였는가
- **뉘앙스**: 경계선이 없는가 / 색이 층으로 겹쳐 보이는가 / 하드 엣지가 없는가
- **텍스처구미**: 파츠 없이 질감만으로 시끄러운가 / 매트와 글로시가 섞였는가

코어당 3장 모두 실패하면 해당 코어의 `signature`·`textureGrammar` 문장을 고쳐 재실측한다. **이게 코케트 때 파일럿 3회 돌았던 루프다.**

- [ ] **Step 8: `attachPhoto` 기본값을 실측 결과로 확정한다**

첨부/미첨부 비교로 코어별 `attachPhoto` 값을 정하고 코어 파일에 반영한다.

```bash
git add config/cores/ ref/results/core-candidates/
git commit -m "test(core): 3개 코어 실측 완료 — attachPhoto 기본값 확정

데코덴·뉘앙스·텍스처구미 각 3장 × 첨부/미첨부 2조건 실측 결과 반영."
```

- [ ] **Step 9: 합격한 컷을 샘플 이미지로 승격한다**

```bash
mkdir -p public/cores
# 합격 컷을 코어 id 이름으로 복사 (예시)
cp ref/results/core-candidates/decoden-noattach/decoden-noattach-02.png public/cores/decoden.png
git add public/cores/
git commit -m "feat(assets): 코어 샘플 이미지 추가 — UI 카드용

실측 합격 컷을 코어 카드 썸네일로 승격 (5단계 UI 그리드 전제 조건)."
```

---

## 다음 계획으로 넘기는 것

이 계획은 스펙 8절의 **단계 1~3**만 다룬다. 아래는 별도 계획이 필요하다:

- **단계 4** — 나머지 11개 코어 작성 + 실측 (`clean-girl`, `jelly-syrup`, `ballet`, `aura-blooming`, `chrome-velvet`, `mermaid-pearl`, `linework`, `cottage-fairy`, `nail-jewellery`, `y2k-mcbling`, `dark-glam`)
- **단계 5** — `POST /api/analyze`에 `coreId` 추가, `PhotoTake` 응답 전환, 코어 선택 그리드 UI, `judgeImage`에 원본 사진 함께 넘기는 호출부 배선

`extractPhotoTake`·`verdictForCore`·`fallbackPlansForCore`는 이 계획에서 만들지만 **API 라우트에는 아직 연결하지 않는다.** 스펙이 `coreId` 배선을 5단계에 배치했고, 기존 경로를 살려두면 앱이 계속 돌아간다.
