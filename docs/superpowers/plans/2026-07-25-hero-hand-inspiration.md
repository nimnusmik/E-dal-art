# 히어로 개편 — 제시하는 손 + 영감 사진 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 첫 화면 히어로를 3D 회전 링에서 "맨손(제시하는 손) 실사 + 영감 사진 4장이 번호·라벨·연결선과 함께 떠 있는 편집형 인덱스"로 교체한다.

**Architecture:** `HeroRing` 컴포넌트/CSS/에셋을 `HeroHand`로 대체한다. 영감 사진은 `heroInspo.ts` 배열(순수 데이터)로 관리해 한 줄로 교체 가능하게 하고, 위치는 CSS에 미리 정의된 4개 앵커에 매핑한다. 매거진 뼈대(매스트헤드·오버라인·h1·서브·CTA·Scroll 큐)와 `.story-hero`/`.hero-*` CSS는 유지한다.

**Tech Stack:** Next.js 15 (App Router, 'use client'), React 19, 순수 CSS(`app/globals.css`), sharp(에셋 크롭/변환), vitest(node 환경, 순수 데이터 테스트).

## Global Constraints

- 모든 UI 문구·주석·커밋 메시지는 한국어.
- 지면 배경 크림 `--bg: #fcfaf7`, 헤어라인 `--line: rgba(26,24,21,0.14)`, 보조텍스트 `--muted: #8a837a`, 이미지 라운드 `--radius-img: 14px` — 기존 토큰 사용.
- 테스트 환경은 `node`. testing-library/jsdom 도입 금지(순수 데이터만 vitest, 시각은 브라우저 검증).
- 영감 사진은 `mix-blend-mode: multiply` 적용 금지(컬러 배경이 탁해짐) — 헤어라인 액자로 처리.
- 파일럿 4장은 워터마크 있는 제3자 이미지 → 자리표시용. 커밋에는 변환 산출물(`public/hero/insp/*.webp`)만 포함, 배포 전 라이선스 이미지로 교체.
- `@media (prefers-reduced-motion: reduce)`에서 진입/hover 모션 생략.

---

### Task 1: 에셋 준비 — 영감 4장 변환 + 손 플레이스홀더

파일럿 4장을 정사각 webp로 변환하고, 레이아웃 확정용 손 플레이스홀더 이미지를 만든다.

**Files:**
- Create: `scripts/prep-hero-assets.mts`
- Create(산출물): `public/hero/insp/tattoo.webp`, `dreamy.webp`, `fairycore.webp`, `wings.webp`
- Create(산출물): `public/hero/hand.webp` (플레이스홀더)

**Interfaces:**
- Produces: `public/hero/insp/{tattoo,dreamy,fairycore,wings}.webp` (각 320×320), `public/hero/hand.webp` (640×800)

- [ ] **Step 1: 변환 스크립트 작성**

`scripts/prep-hero-assets.mts`:
```ts
/**
 * 히어로 개편용 정적 에셋 생성 (일회성, 산출물은 커밋).
 *   npx tsx scripts/prep-hero-assets.mts
 * 산출물: public/hero/insp/*.webp (320px 정사각), public/hero/hand.webp (플레이스홀더)
 */
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PILOT = resolve(ROOT, 'pilot');
const INSP_DIR = resolve(ROOT, 'public/hero/insp');
const HAND = resolve(ROOT, 'public/hero/hand.webp');

// 파일럿 원본 → 산출물명 매핑 (라벨은 heroInspo.ts에서 관리)
const MAP: Array<[string, string]> = [
  ['_ (9).jpeg', 'tattoo.webp'],
  ['_ (12).jpeg', 'dreamy.webp'],
  ['_ (13).jpeg', 'fairycore.webp'],
  ['_ (14).jpeg', 'wings.webp'],
];

async function run() {
  mkdirSync(INSP_DIR, { recursive: true });
  for (const [src, out] of MAP) {
    const from = resolve(PILOT, src);
    if (!existsSync(from)) throw new Error(`원본 없음: ${from}`);
    await sharp(from)
      .resize(320, 320, { fit: 'cover', position: 'attention' })
      .webp({ quality: 82 })
      .toFile(resolve(INSP_DIR, out));
    console.log('생성:', out);
  }

  // 손 플레이스홀더 — 크림 배경 위 부드러운 실루엣 블록 (AI 실사로 교체 예정)
  const placeholder = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800">
       <rect width="640" height="800" fill="#fcfaf7"/>
       <rect x="180" y="120" width="280" height="560" rx="140"
             fill="#efe9e0" stroke="rgba(26,24,21,0.14)" stroke-width="1"/>
       <text x="320" y="410" text-anchor="middle" font-family="serif"
             font-size="26" fill="#8a837a">HAND</text>
     </svg>`,
  );
  await sharp(placeholder).webp({ quality: 82 }).toFile(HAND);
  console.log('생성: hand.webp (플레이스홀더)');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: 스크립트 실행**

Run: `npx tsx scripts/prep-hero-assets.mts`
Expected: `생성: tattoo.webp` … `생성: hand.webp (플레이스홀더)` 출력, 에러 없음

- [ ] **Step 3: 산출물 검증**

Run: `node -e "const s=require('sharp');['tattoo','dreamy','fairycore','wings'].forEach(async n=>{const m=await s('public/hero/insp/'+n+'.webp').metadata();console.log(n,m.width+'x'+m.height,m.format)});s('public/hero/hand.webp').metadata().then(m=>console.log('hand',m.width+'x'+m.height,m.format))"`
Expected: 각 insp `320x320 webp`, hand `640x800 webp`

- [ ] **Step 4: 커밋**

```bash
git add scripts/prep-hero-assets.mts public/hero/
git commit -m "feat(hero): 히어로 에셋 준비 스크립트 + 영감 4장·손 플레이스홀더"
```

---

### Task 2: 영감 사진 데이터 모듈 `heroInspo.ts`

컷 배열을 순수 데이터로 정의하고 불변식(앵커/번호 중복 없음)을 vitest로 검증한다.

**Files:**
- Create: `components/story/heroInspo.ts`
- Test: `tests/heroInspo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type InspoAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  export interface InspoCut { src: string; no: number; label: string; at: InspoAnchor }
  export const HERO_INSPO: InspoCut[]
  ```

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/heroInspo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { HERO_INSPO } from '@/components/story/heroInspo';

describe('HERO_INSPO', () => {
  it('컷은 4개다', () => {
    expect(HERO_INSPO).toHaveLength(4);
  });

  it('앵커(at)는 서로 겹치지 않는다', () => {
    const ats = HERO_INSPO.map((c) => c.at);
    expect(new Set(ats).size).toBe(ats.length);
  });

  it('번호(no)는 서로 겹치지 않는다', () => {
    const nos = HERO_INSPO.map((c) => c.no);
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('모든 src는 /hero/insp/ 아래 webp를 가리킨다', () => {
    for (const c of HERO_INSPO) {
      expect(c.src).toMatch(/^\/hero\/insp\/.+\.webp$/);
    }
  });

  it('모든 라벨은 비어 있지 않다', () => {
    for (const c of HERO_INSPO) expect(c.label.trim().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/heroInspo.test.ts`
Expected: FAIL — "Cannot find module '@/components/story/heroInspo'"

- [ ] **Step 3: 데이터 모듈 작성**

`components/story/heroInspo.ts`:
```ts
/** 히어로 손 둘레에 뜨는 영감 사진 컷. 사진 교체는 이 배열 한 줄 수정으로 끝난다. */
export type InspoAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface InspoCut {
  /** public 기준 절대경로 */
  src: string;
  /** 화면에 찍히는 번호 */
  no: number;
  /** 한글 라벨 */
  label: string;
  /** CSS에 미리 정의된 배치 앵커 */
  at: InspoAnchor;
}

export const HERO_INSPO: InspoCut[] = [
  { src: '/hero/insp/tattoo.webp', no: 2, label: '타투 플래시', at: 'top-left' },
  { src: '/hero/insp/dreamy.webp', no: 3, label: '몽환 파스텔', at: 'top-right' },
  { src: '/hero/insp/fairycore.webp', no: 4, label: '페어리코어', at: 'bottom-left' },
  { src: '/hero/insp/wings.webp', no: 5, label: '엔젤윙', at: 'bottom-right' },
];
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/heroInspo.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add components/story/heroInspo.ts tests/heroInspo.test.ts
git commit -m "feat(hero): 영감 사진 데이터 모듈 heroInspo + 불변식 테스트"
```

---

### Task 3: `HeroHand` 컴포넌트 + 랜딩 배선

`HeroRing`을 대체하는 `HeroHand`를 만들고 `StoryLanding`에서 교체한다.

**Files:**
- Create: `components/story/HeroHand.tsx`
- Modify: `components/story/StoryLanding.tsx:2,13` (import·사용 교체)

**Interfaces:**
- Consumes: `HERO_INSPO`(Task 2), `Masthead`, `currentIssue`
- Produces: `export default function HeroHand()`

- [ ] **Step 1: 컴포넌트 작성**

`components/story/HeroHand.tsx`:
```tsx
'use client';

import Masthead from '@/components/editorial/Masthead';
import { currentIssue } from '@/lib/issue';
import { HERO_INSPO } from './heroInspo';

/** 표지 — 발행호 + 세리프 헤드라인 + 맨손(제시하는 손) 무대에 영감 사진 4장이 라벨과 함께 뜬다. */
export default function HeroHand() {
  const issue = currentIssue();
  return (
    <section className="story-hero" aria-label="이달아 — 이달의 네일 아트">
      <Masthead />
      <div className="hero-body">
        <p className="overline" suppressHydrationWarning>{issue.label}</p>
        <h1 className="hero-title">
          이달의 네일을,
          <br />
          먼저 만나요
        </h1>
        <p className="hero-sub">영감 사진 한 장이면, 당신의 다음 시안이 나와요</p>
        <a className="btn-fill hero-cta" href="#tool">
          이번 호 시안 만들기
        </a>
        <div className="hand-stage" aria-label="영감 사진이 손 위에서 이달의 네일이 되는 장면">
          <img
            className="hand-img"
            src="/hero/hand.webp"
            alt=""
            width={320}
            height={400}
            loading="eager"
            decoding="async"
          />
          {HERO_INSPO.map((cut) => (
            <figure className={`inspo-cut at-${cut.at}`} key={cut.src}>
              <span className="inspo-line" aria-hidden />
              <img className="inspo-img" src={cut.src} alt={`영감 예시 — ${cut.label}`} loading="eager" decoding="async" />
              <figcaption className="inspo-cap">
                <span className="inspo-no">{cut.no}</span>
                {cut.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="hero-cue" aria-hidden>
        Scroll
      </div>
    </section>
  );
}
```

- [ ] **Step 2: `StoryLanding`에서 교체**

`components/story/StoryLanding.tsx` — import 라인과 사용부를 교체:
```tsx
import HeroHand from './HeroHand';
```
```tsx
    <main className="story">
      <HeroHand />
```
(기존 `import HeroRing from './HeroRing';` 및 `<HeroRing />`를 위 내용으로 대체)

- [ ] **Step 3: 타입체크로 배선 검증**

Run: `npm run typecheck`
Expected: 에러 없음 (exit 0)

- [ ] **Step 4: 커밋**

```bash
git add components/story/HeroHand.tsx components/story/StoryLanding.tsx
git commit -m "feat(hero): HeroHand 컴포넌트 추가 및 랜딩 배선 교체"
```

---

### Task 4: CSS — 손 무대·영감 컷·연결선·모션·반응형

`.ring-*` 규칙을 `.hand-stage/.hand-img/.inspo-*` 규칙으로 교체한다.

**Files:**
- Modify: `app/globals.css` (`.ring-stage`~`@keyframes ring-spin` 블록 ≈170–216행 교체, 모바일 `.ring-stage` ≈747–753행 교체, 모션저감 `.ring` ≈761행 교체)

- [ ] **Step 1: 데스크톱 무대·컷 CSS로 교체**

`app/globals.css`에서 `.ring-stage { … }`부터 `@keyframes ring-spin { … }`까지(주석 `/* 3D 링 … */` 포함) 전체를 아래로 교체:
```css
/* 손 무대 — 맨손 중심, 영감 사진 4장이 코너 앵커에 라벨·연결선과 함께 뜬다 */
.hand-stage {
  position: relative;
  width: 100%;
  max-width: 780px;
  height: 420px;
  margin: 12px auto 0;
}

.hand-img {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%); /* 중앙 고정 — translateY 모션과 충돌하므로 이동 없이 페이드만 */
  width: clamp(180px, 24vw, 240px);
  height: auto;
  border-radius: var(--radius-img);
  animation: hand-fade 0.7s ease both;
}

.inspo-cut {
  position: absolute;
  width: clamp(96px, 12vw, 132px);
  margin: 0;
  opacity: 0;
  animation: hero-rise 0.6s ease forwards;
  transition: transform 0.35s ease;
}
.inspo-cut.at-top-left     { left: 4%;  top: 2%;  animation-delay: 0.15s; }
.inspo-cut.at-top-right    { right: 4%; top: 6%;  animation-delay: 0.25s; }
.inspo-cut.at-bottom-left  { left: 7%;  bottom: 4%; animation-delay: 0.35s; }
.inspo-cut.at-bottom-right { right: 6%; bottom: 8%; animation-delay: 0.45s; }

.inspo-img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
  border-radius: var(--radius-img);
  border: 1px solid var(--line);
  box-shadow: var(--shadow-card);
}

.inspo-cap {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 12px;
  letter-spacing: 0.02em;
  color: var(--muted);
}
.inspo-no {
  display: inline-grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border: 1px solid var(--line);
  border-radius: 50%;
  font-size: 10px;
  color: var(--ink);
}

/* 손끝에서 컷으로 뻗는 가는 연결선 (데스크톱 장식) */
.inspo-line {
  position: absolute;
  width: 40px;
  height: 1px;
  background: var(--line);
  top: 40%;
}
.at-top-left .inspo-line,
.at-bottom-left .inspo-line   { right: -44px; }
.at-top-right .inspo-line,
.at-bottom-right .inspo-line  { left: -44px; }

@media (hover: hover) {
  .inspo-cut:hover { transform: scale(1.05); }
  .inspo-cut:hover .inspo-line { background: var(--ink); }
}

@keyframes hero-rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes hand-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

- [ ] **Step 2: 모바일 규칙 교체**

`app/globals.css` 모바일 블록(`@media (max-width: 767px)`)에서 `.ring-stage { … }`를 아래로 교체(연결선 숨김·2×2 그리드):
```css
  .hand-stage {
    height: auto;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    padding-top: 8px;
    justify-items: center;
  }
  .hand-img {
    position: static;
    transform: none;
    grid-column: 1 / -1;
    width: clamp(160px, 44vw, 200px);
    margin: 0 auto 4px;
  }
  .inspo-cut {
    position: static;
    opacity: 1;
    animation: none;
    width: 100%;
    max-width: 150px;
  }
  .inspo-line { display: none; }
```

- [ ] **Step 3: 모션 저감 규칙 교체**

`app/globals.css`의 `@media (prefers-reduced-motion: reduce)` 안 `.ring { … }` 라인을 아래로 교체:
```css
  .hand-img, .inspo-cut { animation: none; opacity: 1; }
```

- [ ] **Step 4: 빌드로 CSS·컴포넌트 통합 검증**

Run: `npm run build`
Expected: 빌드 성공(에러 없음)

- [ ] **Step 5: 커밋**

```bash
git add app/globals.css
git commit -m "style(hero): 손 무대·영감 컷·연결선·진입 모션·반응형 CSS"
```

---

### Task 5: 정리 — 링 잔재 제거

대체된 `HeroRing`·링 이미지·샘플 스크립트의 링 부분을 제거한다.

**Files:**
- Delete: `components/story/HeroRing.tsx`
- Delete: `public/samples/ring-01.webp` … `ring-10.webp`
- Modify: `scripts/generate-samples.mts` (ring 생성 부분 제거 — showcase 생성만 남기고, 헤더 주석의 ring 언급 삭제)

- [ ] **Step 1: 링 컴포넌트·이미지 삭제**

```bash
git rm components/story/HeroRing.tsx public/samples/ring-*.webp
```

- [ ] **Step 2: 잔여 참조 확인**

Run: `grep -rn "HeroRing\|ring-stage\|ring-item\|ring-spin\|samples/ring" app components || echo "잔여 참조 없음"`
Expected: `잔여 참조 없음`

- [ ] **Step 3: 샘플 스크립트에서 ring 생성 제거**

`scripts/generate-samples.mts`에서 ring 팁세트 생성/크롭 로직과 헤더 주석의 `ring-01..10.webp` 언급을 삭제한다(showcase 생성 경로만 유지). 삭제 후 파일이 문법적으로 유효해야 한다.

- [ ] **Step 4: 전체 검증**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: 타입체크 0 에러, 모든 테스트 PASS, 빌드 성공

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore(hero): 회전 링 잔재 제거(HeroRing·ring 이미지·샘플 스크립트 정리)"
```

---

### Task 6: 브라우저 시각 검증 (전후 비교)

실제 렌더를 데스크톱·모바일에서 확인한다.

**Files:** (코드 변경 없음 — 검증 전용)

- [ ] **Step 1: 개발 서버 실행**

Run: `npm run dev` (백그라운드)
Expected: `http://localhost:3000` 기동

- [ ] **Step 2: 데스크톱 스크린샷**

gstack 또는 playwright로 `http://localhost:3000` 열고 뷰포트 1280×800에서 히어로 스크린샷 저장.
확인: 맨손 중앙, 영감 4장이 코너에 번호·라벨·연결선과 함께 표시, 흰 사각 붕뜸 없음, Scroll 큐 존재.

- [ ] **Step 3: 모바일 스크린샷**

뷰포트 390×844에서 스크린샷 저장.
확인: 손 상단, 영감 4장 2×2 그리드, 연결선 없음, 겹침 없음.

- [ ] **Step 4: 결과 보고**

전후(회전 링 → 손 히어로) 비교 스크린샷을 사용자에게 제시. 손 이미지는 플레이스홀더임을 명시하고, AI 실사 손 교체·파일럿→라이선스 이미지 교체를 후속 항목으로 안내.

---

## Self-Review

**1. Spec coverage:**
- 컨셉(맨손+영감 컷) → Task 3 ✓ / 에셋(손·영감) → Task 1 ✓ / heroInspo 배열 → Task 2 ✓ /
  시각처리(액자·multiply 금지) → Task 4 ✓ / 레이아웃(데스크톱·모바일) → Task 4 ✓ /
  모션·reduced-motion → Task 4 ✓ / 접근성(alt·라벨 텍스트) → Task 3 ✓ /
  정리(링 삭제) → Task 5 ✓ / 브라우저 검증 → Task 6 ✓ / 워터마크 주의 → Global Constraints·Task 6 ✓
- 갭 없음.

**2. Placeholder scan:** "TBD/TODO/적절히 처리" 없음. 모든 코드 스텝에 실제 코드·명령·기대출력 포함.

**3. Type consistency:** `InspoCut{src,no,label,at}`·`HERO_INSPO`(Task 2) → `HeroHand`(Task 3)에서 동일 필드 사용 ✓. CSS 클래스 `at-${cut.at}`(Task 3) ↔ `.inspo-cut.at-top-left …`(Task 4) 명명 일치 ✓. `hand-stage/hand-img/inspo-cut/inspo-img/inspo-cap/inspo-no/inspo-line` 컴포넌트↔CSS 일치 ✓.
