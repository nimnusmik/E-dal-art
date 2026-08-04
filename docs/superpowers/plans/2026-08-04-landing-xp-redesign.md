# 랜딩 XP 초원 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이달아 랜딩을 잡지(에디토리얼) 스타일에서 "푸른 하늘·초원 배경 + 파스텔 스티커 카드" 포트폴리오 스타일로 전면 교체하되, 히어로 손 변신 애니메이션과 사진 주입 툴은 동작 그대로 유지한다.

**Architecture:** `components/landing/`에 섹션 컴포넌트 9개를 새로 만들고 `Landing.tsx`가 조립한다. `page.tsx`는 `StoryLanding` 대신 `Landing`을 렌더하며 상태 머신·API 흐름·`toolSlot` 주입 패턴은 손대지 않는다. `HeroHand.tsx`는 잡지 장치(바코드·커버라인·고스트 발행호·크롭마크·매스트헤드)만 걷어내고 rAF 루프·`heroMorph` 타임라인·`.hand-stage` 내부 DOM은 한 글자도 바꾸지 않는다. 스타일은 `app/landing.css`(신규)에 두고 `app/globals.css`는 디자인 토큰만 교체해 내부 화면(생성·결과·마감)이 새 색·폰트를 자동으로 물려받게 한다.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, 순수 CSS(전처리기·CSS-in-JS 없음), Vitest(node 환경), Pretendard + Black Han Sans + Archivo Black(Google Fonts CDN)

## Global Constraints

- **동작 보존 (양보 불가):** `components/story/heroMorph.ts`, `components/story/heroInspo.ts`는 수정 금지. `HeroHand.tsx`의 `applyFrame`/`loop`/`useEffect` 블록과 `.hand-stage` 내부 JSX(`.hand-img`, `.hand-after`, `.hero-flash`, `.inspo-cut`, `.hero-bead`)도 수정 금지 — 스킨(바깥 마크업·CSS)만 교체한다.
- **동작 보존 (양보 불가):** 사진 주입 툴의 동작 — `InspirationTray`(최대 3장), `OptionsPicker`, 생성 CTA, `id="tool"` 앵커, 잔여 횟수 노출 규칙(`remaining <= 10`), 에러 토스트. `app/page.tsx`의 상태 머신·`fetch` 흐름은 수정 금지이며 `toolSlot` 내부 마크업(클래스명·문구)만 교체한다.
- **CSS 보존 (양보 불가):** `app/globals.css`의 292~440행(`.hand-stage` ~ `@keyframes hand-fade`), 1067~1094행의 `.hand-stage`/`.inspo-cut`/`.hero-bead`/`prefers-reduced-motion` 규칙은 삭제·변경 금지.
- **저작권:** Windows XP Bliss 원본 사진 사용 금지. Unsplash 라이선스 사진만 사용하고 출처를 `docs/landing-assets.md`에 기록한다.
- **정직한 카피:** 실제 고객 후기·실적 수치를 지어내지 않는다. 통계는 제품 사실, 후기 섹션은 "예상 사용 장면"임을 화면에 명시한다.
- **신규 npm 의존성 추가 금지.**
- **한국어:** 모든 UI 문구·주석·커밋 메시지는 한국어.
- **작업 브랜치:** `feature/hero-bead-morph` (현재 브랜치 그대로 사용).
- **테스트 현실:** vitest 환경이 `node`이고 jsdom·testing-library가 없다. 컴포넌트 렌더 테스트는 범위 밖이다. TDD는 순수 데이터 모듈(`content.ts`)에 적용하고, 시각 결과물은 `next build` + 브라우저 확인으로 검증한다.

---

## File Structure

**신규**

| 경로 | 책임 |
|---|---|
| `public/landing/meadow.webp` | 하늘+초원 배경 사진 (히어로·갤러리·풋터 CTA 공용) |
| `docs/landing-assets.md` | 배경 사진 출처·라이선스 기록 |
| `app/landing.css` | 랜딩 전용 스타일 전부 (섹션별로 태스크마다 append) |
| `components/landing/content.ts` | 랜딩 카피·데이터(통계/서비스/후기/FAQ/갤러리) 단일 소스 |
| `components/landing/useReveal.ts` | 스크롤 진입 reveal 훅 (기존 `story/hooks.ts` 이관) |
| `components/landing/TopBar.tsx` | 상단 미니 바 (로고 + 필 배지) |
| `components/landing/Stats.tsx` | 인트로 카피 + 제품 사실 카드 4장 |
| `components/landing/Gallery.tsx` | 초원 배경 위 폴라로이드 시안 카드 |
| `components/landing/Services.tsx` | 파스텔 필 5행 (이용 흐름) |
| `components/landing/ToolSection.tsx` | 사진 주입 툴을 감싸는 흰 카드 셸 |
| `components/landing/Testimonials.tsx` | 페르소나 예상 사용 장면 카드 3장 |
| `components/landing/Faq.tsx` | 산개 배치 FAQ 필 |
| `components/landing/FooterCta.tsx` | 초대형 타이포 CTA + 미니 풋터 |
| `components/landing/Landing.tsx` | 위 섹션 조립 (`StoryLanding` 대체) |
| `tests/landingContent.test.ts` | `content.ts` 데이터 규칙 테스트 |

**수정**

| 경로 | 변경 |
|---|---|
| `app/globals.css:1-24` | 디자인 토큰 교체 (색·폰트·라운드) |
| `app/globals.css:144-291` | 잡지 전용 스타일 삭제 (표지 장치·티커) |
| `app/globals.css:465-595` | 섹션 헤더·HowItWorks·story-tool 스타일 삭제 |
| `app/globals.css:1044-1055` | `.story-footer` 삭제 |
| `app/layout.tsx:24-30` | Archivo Black 추가, themeColor 갱신 |
| `app/page.tsx:8-9,297-339` | `StoryLanding`→`Landing`, toolSlot 마크업 교체 |
| `components/story/HeroHand.tsx:145-239` | JSX 스킨 교체 (로직 블록 불변) |

**삭제**

`components/story/StoryLanding.tsx`, `components/story/HowItWorks.tsx`, `components/story/StoryFooter.tsx`, `components/story/hooks.ts`, `components/editorial/Masthead.tsx`

---

## Task 1: 배경 사진 자산 확보

**Files:**
- Create: `public/landing/meadow.webp`
- Create: `docs/landing-assets.md`

**Interfaces:**
- Consumes: 없음
- Produces: `/landing/meadow.webp` — 이후 모든 초원 배경 섹션이 참조하는 경로

- [ ] **Step 1: 사진 내려받기**

Unsplash의 초원+하늘 사진(Sean O. 촬영, Unsplash License — 상업적 사용·출처표기 불필요)을 받는다.

```bash
cd ~/Desktop/projects/nailspo
mkdir -p public/landing
curl -sL --max-time 60 -o /tmp/meadow.jpg \
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=2400&q=80&fm=jpg"
ls -lh /tmp/meadow.jpg
```

Expected: 파일 크기 500KB 이상으로 출력됨

- [ ] **Step 2: webp로 변환**

```bash
cd ~/Desktop/projects/nailspo
sips -s format webp -s formatOptions 72 --resampleWidth 2000 \
  /tmp/meadow.jpg --out public/landing/meadow.webp
ls -lh public/landing/meadow.webp
```

Expected: `public/landing/meadow.webp` 생성, 크기 400KB 이하

변환 실패 시(webp 미지원 sips) 폴백:
```bash
sips -s format jpeg -s formatOptions 70 --resampleWidth 2000 \
  /tmp/meadow.jpg --out public/landing/meadow.jpg
```
폴백을 썼다면 이후 모든 태스크에서 `/landing/meadow.webp`를 `/landing/meadow.jpg`로 읽는다.

- [ ] **Step 3: 이미지가 실제로 열리는지 확인**

```bash
cd ~/Desktop/projects/nailspo && sips -g pixelWidth -g pixelHeight public/landing/meadow.webp
```

Expected: `pixelWidth: 2000`, `pixelHeight`가 1000~1400 사이 값으로 출력

- [ ] **Step 4: 출처 기록 작성**

`docs/landing-assets.md`:

```markdown
# 랜딩 이미지 자산 출처

## public/landing/meadow.webp

- 원본: https://unsplash.com/photos/mountain-covered-with-green-grass-KMn4VEeEPR8
- 촬영: Sean O. (Unsplash)
- 라이선스: Unsplash License — 상업적 사용 가능, 출처 표기 불필요, 재판매 금지
- 가공: 폭 2000px 리사이즈 + webp 변환 (sips)
- 용도: 랜딩 히어로 · 갤러리 · 풋터 CTA 배경

## 주의

Windows XP 기본 배경화면(Bliss, Charles O'Rear 촬영)은 Microsoft 저작물이므로
이 프로젝트에서 사용하지 않는다. 위 사진은 유사한 분위기의 별개 저작물이다.
```

- [ ] **Step 5: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add public/landing docs/landing-assets.md
git commit -m "feat(landing): 초원 배경 사진 자산 추가"
```

---

## Task 2: 디자인 토큰 · 폰트 교체

**Files:**
- Modify: `app/globals.css:1-24` (`:root` 블록)
- Modify: `app/layout.tsx:9-13, 24-30`

**Interfaces:**
- Consumes: 없음
- Produces: CSS 변수 — `--paper`, `--paper-card`, `--ink`, `--muted`, `--line`, `--line-soft`, `--accent`, `--sky`, `--pastel-pink`, `--pastel-blue`, `--pastel-yellow`, `--pastel-green`, `--pastel-purple`, `--radius-card`, `--radius-img`, `--radius-btn`, `--shadow-card`, `--shadow-lift`, `--space-section`, `--font-display`, `--font-sans`, `--font-serif`, `--font-latin`. 이후 모든 태스크가 이 변수만 사용한다.

- [ ] **Step 1: `:root` 블록 교체**

`app/globals.css`의 1~24행(`/* ─── 에디토리얼 디자인 토큰 ... */`부터 `}`까지)을 아래로 교체한다. `--font-serif`·`--font-latin`은 내부 화면(생성·결과)이 아직 참조하므로 남기되 새 폰트를 가리키게 한다.

```css
/* ─── XP 초원 디자인 토큰 ────────────────────────────────────── */
:root {
  --paper: #f4f3ef;         /* 종이 지면 */
  --paper-card: #ffffff;    /* 카드 흰색 */
  --bg: var(--paper);       /* 내부 화면 호환 별칭 */
  --bg-deep: #eceae4;       /* 인풋/캡션 바닥 */
  --ink: #16181d;           /* 잉크 블랙 */
  --muted: #6f7480;         /* 보조 텍스트 */
  --line: rgba(22, 24, 29, 0.12);
  --line-soft: rgba(22, 24, 29, 0.06);

  --shadow-card: 0 1px 2px rgba(22, 24, 29, 0.05), 0 14px 34px rgba(22, 24, 29, 0.09);
  --shadow-lift: 0 8px 18px rgba(22, 24, 29, 0.10), 0 28px 60px rgba(22, 24, 29, 0.16);

  --radius-card: 22px;
  --radius-img: 16px;
  --radius-btn: 999px;

  --space-section: clamp(88px, 12vh, 148px);

  /* 파스텔 5색 — 필 배지·카드 블롭·FAQ에 순환 사용 */
  --pastel-pink: #ffd8e2;
  --pastel-blue: #cfe3ff;
  --pastel-yellow: #ffe9a6;
  --pastel-green: #cdf0d6;
  --pastel-purple: #e3d9ff;

  --sky: #5aa9e6;           /* 하늘 파랑 — 링크·포커스 */
  --accent: #1f6fd0;        /* 시그니처 포인트 */

  /* 디스플레이 = 초대형 헤비 타이포 (라틴 Archivo Black + 한글 Black Han Sans) */
  --font-display: 'Archivo Black', 'Black Han Sans', 'Pretendard Variable', sans-serif;
  --font-sans: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
  /* 내부 화면 호환 — 기존 .headline/.overline이 참조 */
  --font-serif: var(--font-display);
  --font-latin: 'Archivo Black', 'Pretendard Variable', sans-serif;
}
```

- [ ] **Step 2: 별표 오너먼트 제거**

`app/globals.css`의 `.overline::after` 규칙(52~53행)을 삭제한다. 잡지 시그니처라 새 디자인과 맞지 않는다.

```css
/* 삭제할 두 줄
.overline::after { content: ' ✦'; color: var(--accent); font-size: 0.85em; }
.masthead-issue.overline::after { content: none; }
*/
```

- [ ] **Step 3: 폰트 링크·테마 컬러 갱신**

`app/layout.tsx`의 `viewport` themeColor와 Google Fonts 링크를 교체한다.

```tsx
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#5aa9e6',
};
```

```tsx
        {/* 초대형 디스플레이 — 라틴(Archivo Black) + 한글(Black Han Sans) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Black+Han+Sans&display=swap"
        />
```

- [ ] **Step 4: 랜딩 CSS 파일 생성 및 연결**

`app/landing.css`를 만든다(내용은 이후 태스크에서 append):

```css
/* ─── 랜딩 전용 스타일 (XP 초원 스킨) ────────────────────────── */
/* 섹션 순서: TopBar → Hero → Stats → Gallery → Services → Tool
   → Testimonials → FAQ → FooterCta */

/* 초원 배경 공용 — 히어로·갤러리·풋터 CTA가 함께 쓴다 */
.xp-meadow {
  position: relative;
  background-image: url('/landing/meadow.jpg');
  background-size: cover;
  background-position: center 62%;
  isolation: isolate;
}

/* 배경 위 텍스트 대비 확보 — 상단만 살짝 어둡게 */
.xp-meadow::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(180deg, rgba(18, 34, 58, 0.22) 0%, rgba(18, 34, 58, 0) 46%);
  pointer-events: none;
}

/* 초대형 흰 디스플레이 타이포 — 참조의 헤드라인 처리 */
.xp-display {
  font-family: var(--font-display);
  color: #fff;
  line-height: 0.94;
  letter-spacing: -0.02em;
  text-transform: uppercase;
  word-break: keep-all;
  text-shadow:
    0 2px 0 rgba(16, 26, 44, 0.22),
    0 14px 38px rgba(16, 26, 44, 0.34);
}

/* 파스텔 필 배지 */
.xp-pill {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 16px;
  border-radius: var(--radius-btn);
  background: var(--paper-card);
  box-shadow: var(--shadow-card);
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  white-space: nowrap;
}
.xp-pill.t-pink   { background: var(--pastel-pink); }
.xp-pill.t-blue   { background: var(--pastel-blue); }
.xp-pill.t-yellow { background: var(--pastel-yellow); }
.xp-pill.t-green  { background: var(--pastel-green); }
.xp-pill.t-purple { background: var(--pastel-purple); }

/* 흰 지면 섹션 — 도트 그리드 + 왼쪽 스프링 코일 */
.xp-paper {
  position: relative;
  background-color: var(--paper);
  background-image: radial-gradient(var(--line-soft) 1.2px, transparent 1.2px);
  background-size: 22px 22px;
  padding: var(--space-section) clamp(20px, 5vw, 64px);
}

/* 스프링노트 코일 — 왼쪽 가장자리 점선 */
.xp-paper::before {
  content: '';
  position: absolute;
  left: clamp(10px, 2.2vw, 26px);
  top: 0;
  bottom: 0;
  width: 3px;
  background-image: linear-gradient(var(--pastel-green) 0 14px, transparent 14px 30px);
  background-size: 3px 30px;
  opacity: 0.85;
  pointer-events: none;
}

@media (max-width: 767px) {
  .xp-paper::before { display: none; }
}

/* 섹션 공통 헤더 */
.xp-head {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  margin: 0 auto clamp(40px, 6vh, 68px);
  text-align: center;
}

.xp-head h2 {
  font-family: var(--font-display);
  font-size: clamp(28px, 4.4vw, 46px);
  line-height: 1.14;
  letter-spacing: -0.02em;
  color: var(--ink);
  word-break: keep-all;
}

.xp-head p {
  max-width: 46ch;
  font-size: 15px;
  line-height: 1.75;
  color: var(--muted);
  word-break: keep-all;
}

/* 스크롤 진입 reveal */
.xp-reveal {
  opacity: 0;
  transform: translateY(16px);
  transition: opacity 0.6s ease var(--d, 0ms), transform 0.6s ease var(--d, 0ms);
}
.is-revealed .xp-reveal,
.is-revealed.xp-reveal { opacity: 1; transform: none; }

@media (prefers-reduced-motion: reduce) {
  .xp-reveal { transition-duration: 0.01ms; }
}
```

`app/layout.tsx`에서 globals.css 다음 줄에 import를 추가한다:

```tsx
import './globals.css';
import './landing.css';
```

- [ ] **Step 5: 빌드가 깨지지 않는지 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: 에러 없이 종료 (exit 0)

- [ ] **Step 6: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add app/globals.css app/landing.css app/layout.tsx
git commit -m "feat(landing): XP 초원 디자인 토큰·폰트·공용 스타일 도입"
```

---

## Task 3: 랜딩 콘텐츠 데이터 모듈 (TDD)

**Files:**
- Create: `components/landing/content.ts`
- Create: `tests/landingContent.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `export type Tone = 'pink' | 'blue' | 'yellow' | 'green' | 'purple'`
  - `export interface StatCard { value: string; label: string; body: string; tone: Tone }`
  - `export const STATS: StatCard[]` (길이 4)
  - `export interface ServiceRow { no: string; label: string; tone: Tone }`
  - `export const SERVICES: ServiceRow[]` (길이 5)
  - `export interface GalleryCut { src: string; title: string; meta: string; tilt: number }`
  - `export const GALLERY: GalleryCut[]` (길이 4)
  - `export interface SceneCard { persona: string; role: string; quote: string; body: string }`
  - `export const SCENES: SceneCard[]` (길이 3)
  - `export interface FaqPill { q: string; tone: Tone }`
  - `export const FAQS: FaqPill[]` (길이 6)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/landingContent.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { STATS, SERVICES, GALLERY, SCENES, FAQS } from '@/components/landing/content';

const TONES = ['pink', 'blue', 'yellow', 'green', 'purple'];

describe('랜딩 콘텐츠', () => {
  it('통계 카드는 4장이다', () => {
    expect(STATS).toHaveLength(4);
  });

  it('통계 카드의 값과 문구는 비어 있지 않다', () => {
    for (const s of STATS) {
      expect(s.value.trim().length).toBeGreaterThan(0);
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('서비스 행은 5개이고 번호가 겹치지 않는다', () => {
    expect(SERVICES).toHaveLength(5);
    const nos = SERVICES.map((s) => s.no);
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('갤러리 컷은 4장이고 src는 webp를 가리킨다', () => {
    expect(GALLERY).toHaveLength(4);
    for (const g of GALLERY) {
      expect(g.src).toMatch(/^\/.+\.webp$/);
    }
  });

  it('갤러리 기울기는 -6도에서 6도 사이다', () => {
    for (const g of GALLERY) {
      expect(Math.abs(g.tilt)).toBeLessThanOrEqual(6);
    }
  });

  it('사용 장면 카드는 3장이다', () => {
    expect(SCENES).toHaveLength(3);
    for (const s of SCENES) {
      expect(s.quote.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('FAQ는 6개이고 모두 물음표로 끝난다', () => {
    expect(FAQS).toHaveLength(6);
    for (const f of FAQS) {
      expect(f.q.trim().endsWith('?')).toBe(true);
    }
  });

  it('모든 톤 값은 파스텔 5색 중 하나다', () => {
    const tones = [
      ...STATS.map((s) => s.tone),
      ...SERVICES.map((s) => s.tone),
      ...FAQS.map((f) => f.tone),
    ];
    for (const t of tones) expect(TONES).toContain(t);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd ~/Desktop/projects/nailspo && npx vitest run tests/landingContent.test.ts
```

Expected: FAIL — `Failed to resolve import "@/components/landing/content"`

- [ ] **Step 3: 콘텐츠 모듈 작성**

`components/landing/content.ts`:

```ts
/**
 * 랜딩 카피·데이터 단일 소스.
 * 수치는 전부 제품 사실이어야 한다 — 없는 실적·후기를 지어내지 않는다.
 */
export type Tone = 'pink' | 'blue' | 'yellow' | 'green' | 'purple';

export interface StatCard {
  /** 카드 상단 큰 숫자 */
  value: string;
  /** 숫자 아래 제목 */
  label: string;
  /** 설명 두 줄 */
  body: string;
  /** 모서리 블롭 색 */
  tone: Tone;
}

export const STATS: StatCard[] = [
  {
    value: '5종',
    label: '한 번에 나오는 시안',
    body: '사진 한 세트로 색·구조·파츠가 다른 다섯 갈래를 동시에 만들어요.',
    tone: 'green',
  },
  {
    value: '3장',
    label: '필요한 영감 사진',
    body: '스크린샷, 좋아하는 옷, 오늘의 하늘. 최대 세 장이면 충분해요.',
    tone: 'yellow',
  },
  {
    value: '100%',
    label: 'AI 검수 통과작만',
    body: '파츠 배치와 물리 법칙을 검수해 통과한 시안만 화면에 올라와요.',
    tone: 'pink',
  },
  {
    value: '매월',
    label: '새로 발행되는 호',
    body: '이달의 무드로 갱신돼요. 지난달 시안과 섞이지 않아요.',
    tone: 'purple',
  },
];

export interface ServiceRow {
  no: string;
  label: string;
  tone: Tone;
}

export const SERVICES: ServiceRow[] = [
  { no: '01', label: '영감 사진 분석', tone: 'pink' },
  { no: '02', label: '5종 변주 생성', tone: 'blue' },
  { no: '03', label: 'AI 품질 검수', tone: 'yellow' },
  { no: '04', label: '손 착용샷 합성', tone: 'green' },
  { no: '05', label: '이달의 호 발행', tone: 'purple' },
];

export interface GalleryCut {
  /** public 기준 절대경로 */
  src: string;
  title: string;
  /** 카드 하단 메타 문구 */
  meta: string;
  /** 폴라로이드 기울기(도) */
  tilt: number;
}

export const GALLERY: GalleryCut[] = [
  { src: '/hero/insp/tattoo.webp', title: '타투 플래시', meta: '라인 아트 · 블랙', tilt: -4 },
  { src: '/hero/insp/dreamy.webp', title: '몽환 파스텔', meta: '시어 밀키 · 글레이즈드', tilt: 3 },
  { src: '/hero/insp/fairycore.webp', title: '페어리코어', meta: '플로럴 · 아이보리', tilt: -2 },
  { src: '/hero/insp/wings.webp', title: '엔젤윙', meta: '크롬 · 화이트 펄', tilt: 5 },
];

export interface SceneCard {
  persona: string;
  role: string;
  quote: string;
  body: string;
}

/** 실제 후기가 아니라 "이렇게 쓰이면 좋겠다"는 예상 장면 — 화면에도 그렇게 표기한다 */
export const SCENES: SceneCard[] = [
  {
    persona: '네일샵 원장',
    role: '예상 사용 장면',
    quote: '이달의 아트 세트를 하루 만에 정리해요',
    body: '핀터레스트에 모아둔 영감을 올리면 번호가 붙은 시안 세트가 나와요. 인스타에 그대로 올릴 수 있어요.',
  },
  {
    persona: '셀프 네일러',
    role: '예상 사용 장면',
    quote: '내 손에 올린 모습까지 미리 봐요',
    body: '마음에 든 시안은 착용샷으로 확인해요. 길이와 쉐입을 바꿔가며 비교할 수 있어요.',
  },
  {
    persona: '네일 러버',
    role: '예상 사용 장면',
    quote: '샵에 가져갈 사진이 생겨요',
    body: '말로 설명하기 어려웠던 무드를 시안 한 장으로 보여줘요. 재료 조합까지 함께 나와요.',
  },
];

export interface FaqPill {
  q: string;
  tone: Tone;
}

export const FAQS: FaqPill[] = [
  { q: '어떤 사진을 올리면 좋아요?', tone: 'pink' },
  { q: '하루에 몇 번까지 만들 수 있어요?', tone: 'green' },
  { q: '무료인가요?', tone: 'yellow' },
  { q: '시안은 저장되나요?', tone: 'blue' },
  { q: '손 착용샷도 만들 수 있어요?', tone: 'purple' },
  { q: '길이랑 쉐입을 바꿀 수 있어요?', tone: 'pink' },
];
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd ~/Desktop/projects/nailspo && npx vitest run tests/landingContent.test.ts
```

Expected: PASS — 8 tests passed

- [ ] **Step 5: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/content.ts tests/landingContent.test.ts
git commit -m "feat(landing): 랜딩 콘텐츠 데이터 모듈 추가"
```

---

## Task 4: TopBar + reveal 훅

**Files:**
- Create: `components/landing/TopBar.tsx`
- Create: `components/landing/useReveal.ts`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `currentIssue` (`@/lib/issue`)
- Produces:
  - `export default function TopBar(): JSX.Element` — `position: fixed` 상단 바
  - `export function useReveal<T extends HTMLElement>(threshold?: number): MutableRefObject<T | null>` — 요소가 뷰포트에 들어오면 `is-revealed` 클래스를 한 번 붙인다

- [ ] **Step 1: reveal 훅 작성**

기존 `components/story/hooks.ts`의 내용을 그대로 옮긴다(로직 동일, 주석만 새 이름에 맞게 수정). `components/landing/useReveal.ts`:

```ts
'use client';

import { useEffect, useRef } from 'react';

/** 스크롤 진입 시 1회 `is-revealed`를 붙여 자식 .xp-reveal을 순차 노출시킨다 (IntersectionObserver) */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-revealed');
            io.unobserve(e.target);
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
```

원본 `components/story/hooks.ts`는 Task 12에서 삭제한다.

- [ ] **Step 2: TopBar 작성**

`components/landing/TopBar.tsx`:

```tsx
import { currentIssue } from '@/lib/issue';

/** 상단 미니 바 — 로고 + 발행호 배지. 스크롤과 무관하게 항상 고정. */
export default function TopBar() {
  const issue = currentIssue();
  return (
    <header className="xp-topbar">
      <a className="xp-logo" href="#top">
        이달아<span aria-hidden>✳</span>
      </a>
      <nav className="xp-topnav">
        <span className="xp-pill t-blue" suppressHydrationWarning>
          VOL.{issue.vol} 발행 중
        </span>
        <a className="xp-pill t-green" href="#tool">
          시안 만들기
        </a>
      </nav>
    </header>
  );
}
```

- [ ] **Step 3: 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 상단 바 ────────────────────────────────────────────────── */
.xp-topbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 14px clamp(16px, 4vw, 44px);
  pointer-events: none;
}

.xp-topbar > * { pointer-events: auto; }

.xp-logo {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 15px;
  border-radius: var(--radius-btn);
  background: var(--paper-card);
  box-shadow: var(--shadow-card);
  font-family: var(--font-display);
  font-size: 14px;
  letter-spacing: 0.02em;
  color: var(--ink);
}

.xp-logo span { color: var(--sky); font-size: 11px; }

.xp-topnav { display: flex; align-items: center; gap: 8px; }

@media (max-width: 520px) {
  .xp-topnav .xp-pill:first-child { display: none; }
}
```

- [ ] **Step 4: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 5: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/TopBar.tsx components/landing/useReveal.ts app/landing.css
git commit -m "feat(landing): 상단 바와 reveal 훅 추가"
```

---

## Task 5: 히어로 스킨 교체 (손 애니메이션 보존)

**Files:**
- Modify: `components/story/HeroHand.tsx:1-8, 145-239` (import 구문과 `return` 블록만)
- Modify: `app/landing.css` (append)
- Modify: `app/globals.css` — 잡지 표지 스타일 삭제 (159~265행, 267~291행 중 지정 부분)

**Interfaces:**
- Consumes: `currentIssue` (`@/lib/issue`), `HERO_INSPO`, `heroMorph` 타임라인 — 전부 기존 그대로
- Produces: `export default function HeroHand(): JSX.Element` — 시그니처 불변. 바깥 컨테이너 클래스가 `.story-hero` → `.xp-hero`로 바뀐다.

**절대 건드리지 말 것:** 파일 16~143행(`useRef`·`applyFrame`·`loop`·`useEffect`). 그리고 아래 JSX에서 `.hand-stage` div와 그 내부 전체는 원본과 한 글자도 달라선 안 된다.

- [ ] **Step 1: import 정리**

`components/story/HeroHand.tsx`의 4행 `import Masthead from '@/components/editorial/Masthead';`를 삭제한다. 나머지 import는 그대로 둔다.

- [ ] **Step 2: JSX 교체**

145행부터 파일 끝까지(`return (` ~ `}`)를 아래로 교체한다.

```tsx
  return (
    <section className="xp-hero xp-meadow" id="top" aria-label="이달아 — 이달의 네일 아트">
      <div className="xp-hero-copy">
        <div className="xp-hero-pills" aria-hidden>
          <span className="xp-pill t-pink xp-float f1">✨ K-네일 트렌드</span>
          <span className="xp-pill t-yellow xp-float f2" suppressHydrationWarning>
            {issue.monthLabel}
          </span>
          <span className="xp-pill t-green xp-float f3">● 지금 무료</span>
        </div>
        <h1 className="xp-display xp-hero-title">
          사진 한 장이
          <br />
          이달의 네일이 돼요
        </h1>
        <p className="xp-hero-sub">
          영감 사진을 올리면 AI가 다섯 갈래 시안을 만들어요. 마음에 든 시안은 내 손에 올려볼 수 있어요.
        </p>
        <a className="xp-cta" href="#tool">
          이번 호 시안 만들기
        </a>
      </div>
      {/* ↓↓↓ 이 무대는 heroMorph 타임라인과 1:1로 묶여 있다 — 구조 변경 금지 ↓↓↓ */}
      <div
        className="hand-stage"
        ref={stageRef}
        role="img"
        aria-label="영감 사진이 구슬이 되어 손을 감싸면 맨손톱이 이달의 네일로 재탄생하는 장면"
      >
        <img
          className="hand-img"
          src="/hero/hand.webp"
          alt=""
          width={500}
          height={898}
          loading="eager"
          decoding="async"
        />
        {/* 변신 후 손 — 맨손과 같은 크기로 겹쳐 두고 손톱부터 원형 리빌.
            t≈5.8s까지는 화면에 보이지 않으므로 LCP 이미지(hand.webp)와 우선순위를
            다투지 않게 낮춘다 — 단, reduced(모션 축소) 사용자는 바로 보이므로 그대로 높게. */}
        <img
          className={`hand-after${reduced ? ' is-static' : ''}`}
          ref={afterRef}
          src={AFTER_SRC}
          alt=""
          width={500}
          height={898}
          loading="eager"
          decoding="async"
          fetchPriority={reduced ? 'high' : 'low'}
        />
        {!reduced && <div className="hero-flash" ref={flashRef} aria-hidden />}
        {HERO_INSPO.map((cut, i) => (
          <figure
            className={`inspo-cut at-${cut.at}`}
            key={cut.src}
            ref={(el) => { cardRefs.current[i] = el; }}
          >
            <span className="inspo-no">{cut.no}</span>
            <img className="inspo-img" src={cut.src} alt={`영감 예시 — ${cut.label}`} width={132} height={132} loading="eager" decoding="async" />
            <figcaption className="inspo-cap">{cut.label}</figcaption>
          </figure>
        ))}
        {!reduced && HERO_INSPO.map((cut, i) => (
          <div
            className="hero-bead"
            key={cut.src}
            aria-hidden
            ref={(el) => { beadRefs.current[i] = el; }}
          >
            <img src={cut.src} alt="" draggable={false} />
          </div>
        ))}
      </div>
      {/* ↑↑↑ 무대 끝 ↑↑↑ */}
      <div className="xp-hero-cue" aria-hidden>Scroll</div>
    </section>
  );
}
```

- [ ] **Step 3: 잡지 표지 스타일 삭제**

`app/globals.css`에서 아래 블록들을 삭제한다. 시작·끝 주석을 기준으로 찾는다.

- `/* S1. 히어로 — 표지 */` 의 `.story-hero { ... }` 와 `.story-hero > .masthead, ... { ... }` (148~157행)
- `/* 거대한 고스트 발행호 — 편집 워터마크 */` 의 `.hero-volnum { ... }` (159~173행)
- `/* 표지 커버라인 ... */` 의 `.coverline`, `.coverline em`, `.cl-left`, `.cl-right` (175~194행)
- `/* 표지 바코드 + 가격 ... */` 의 `.hero-issue-tag`, `.barcode`, `.issue-price`, `.issue-price em`, 바로 뒤의 `@media (max-width: 767px) { .coverline ... }` (196~226행)
- `/* 마퀴 티커 ... */` 의 `.ticker`, `.ticker-track`, `.ticker-track span`, `@keyframes ticker-run`, 뒤따르는 `@media (prefers-reduced-motion: reduce) { .ticker-track ... }` (228~257행)
- `/* 아트프린트 등록(크롭) 마크 ... */` 의 `.hero-marks`, `.hero-marks i` 4개 규칙 (259~265행)
- `.hero-body`, `.hero-title`, `.hero-sub`, `.hero-cta` (267~290행)
- `.hero-cue`, `.hero-cue::before` (442~463행)
- `/* ─── 매스트헤드 ... */` 의 `.masthead`, `.masthead-wordmark`, `.masthead-issue`, `.screen .masthead` (75~95행) — 매스트헤드는 내부 화면에서도 제거하므로 Task 12에서 함께 검증한다. **이번 태스크에서는 삭제하지 말고 그대로 둔다.**

`@media (max-width: 767px)` 블록(1068행~) 안의 `.masthead { padding: ... }` 한 줄도 이번 태스크에서는 그대로 둔다.

**남겨야 하는 것:** `.hand-stage`부터 `@keyframes hand-fade`까지(292~440행) 전부, 모바일 블록의 `.hand-stage`/`.inspo-cut`/`.inspo-cap`/`.hero-body`/`.hero-bead` 규칙, 모션 저감 블록 전체.

모바일 블록의 `.hero-body { padding-left: 40px; padding-right: 40px; }`는 클래스가 사라지므로 `.xp-hero-copy`로 이름만 바꾼다:

```css
  .xp-hero-copy { padding-left: 40px; padding-right: 40px; }
```

- [ ] **Step 4: 히어로 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 히어로 ─────────────────────────────────────────────────── */
.xp-hero {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: clamp(96px, 14vh, 148px) 24px 64px;
  overflow: clip;
}

.xp-hero-copy {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  max-width: 900px;
}

.xp-hero-pills { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }

.xp-hero-title { font-size: clamp(38px, 7.4vw, 92px); }

.xp-hero-sub {
  max-width: 44ch;
  font-size: clamp(15px, 1.6vw, 17px);
  line-height: 1.7;
  font-weight: 600;
  color: #fff;
  word-break: keep-all;
  text-shadow: 0 2px 14px rgba(16, 26, 44, 0.5);
}

.xp-cta {
  display: inline-block;
  margin-top: 4px;
  padding: 16px 34px;
  border-radius: var(--radius-btn);
  background: var(--ink);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  box-shadow: var(--shadow-lift);
  transition: transform 0.15s ease;
}
.xp-cta:active { transform: scale(0.98); }

/* 손 무대는 히어로 카피 아래 — .hand-stage 자체 규칙은 globals.css가 소유 */
.xp-hero .hand-stage { position: relative; z-index: 1; margin-top: clamp(16px, 3vh, 40px); }

/* 필 배지 부유 모션 */
.xp-float { animation: xp-bob 4.5s ease-in-out infinite; }
.xp-float.f2 { animation-delay: 0.6s; }
.xp-float.f3 { animation-delay: 1.2s; }

@keyframes xp-bob {
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-7px); }
}

.xp-hero-cue {
  position: absolute;
  bottom: 18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #fff;
  text-shadow: 0 2px 10px rgba(16, 26, 44, 0.55);
}

@media (prefers-reduced-motion: reduce) {
  .xp-float { animation: none; }
}
```

- [ ] **Step 5: 히어로 관련 테스트가 여전히 통과하는지 확인**

```bash
cd ~/Desktop/projects/nailspo && npx vitest run tests/heroMorph.test.ts tests/heroInspo.test.ts
```

Expected: PASS — 두 파일 모두 통과 (애니메이션 로직을 건드리지 않았음을 확인)

- [ ] **Step 6: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/story/HeroHand.tsx app/landing.css app/globals.css
git commit -m "feat(landing): 히어로를 초원 배경 스킨으로 교체 (손 애니메이션 보존)"
```

---

## Task 6: Stats 섹션

**Files:**
- Create: `components/landing/Stats.tsx`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `STATS` (Task 3), `useReveal` (Task 4)
- Produces: `export default function Stats(): JSX.Element`

- [ ] **Step 1: 컴포넌트 작성**

`components/landing/Stats.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { STATS } from './content';
import { useReveal } from './useReveal';

/** 인트로 카피 + 제품 사실 카드 4장. 카드 모서리에 파스텔 블롭이 얹힌다. */
export default function Stats() {
  const ref = useReveal<HTMLDivElement>();
  return (
    <section className="xp-paper xp-stats" aria-label="이달아가 만드는 것">
      <div className="xp-head">
        <span className="xp-pill t-blue">About</span>
        <h2>
          기억에 남는 시안을
          <br />
          만들어요
        </h2>
        <p>
          영감 사진을 이달의 무드로 옮겨 담아요. 색과 구조가 다른 다섯 갈래를 한 번에 보고,
          마음에 든 시안만 손에 올려봐요.
        </p>
        <a className="xp-cta xp-cta-sm" href="#tool">
          시작하기
        </a>
      </div>
      <div className="xp-stat-grid" ref={ref}>
        {STATS.map((s, i) => (
          <article
            className={`xp-card xp-reveal blob-${s.tone}`}
            style={{ '--d': `${i * 90}ms` } as CSSProperties}
            key={s.label}
          >
            <span className="xp-stat-value">{s.value}</span>
            <h3>{s.label}</h3>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 통계 카드 ──────────────────────────────────────────────── */
.xp-cta-sm { padding: 13px 26px; font-size: 14px; }

.xp-stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(16px, 2.4vw, 26px);
  max-width: 880px;
  margin: 0 auto;
}

.xp-card {
  position: relative;
  padding: clamp(22px, 2.6vw, 30px);
  border-radius: var(--radius-card);
  background: var(--paper-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
}

/* 모서리 파스텔 블롭 */
.xp-card::after {
  content: '';
  position: absolute;
  right: -26px;
  top: -26px;
  width: 92px;
  height: 92px;
  border-radius: 46% 54% 52% 48% / 50% 46% 54% 50%;
  opacity: 0.95;
}
.blob-pink::after   { background: var(--pastel-pink); }
.blob-blue::after   { background: var(--pastel-blue); }
.blob-yellow::after { background: var(--pastel-yellow); }
.blob-green::after  { background: var(--pastel-green); }
.blob-purple::after { background: var(--pastel-purple); }

.xp-stat-value {
  display: block;
  font-family: var(--font-display);
  font-size: clamp(34px, 4.6vw, 52px);
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.xp-card h3 {
  margin-top: 14px;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  word-break: keep-all;
}

.xp-card p {
  margin-top: 7px;
  font-size: 13.5px;
  line-height: 1.72;
  color: var(--muted);
  word-break: keep-all;
}

@media (max-width: 640px) {
  .xp-stat-grid { grid-template-columns: 1fr; }
}
```

- [ ] **Step 3: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/Stats.tsx app/landing.css
git commit -m "feat(landing): 제품 사실 통계 카드 섹션 추가"
```

---

## Task 7: Gallery 섹션 (폴라로이드)

**Files:**
- Create: `components/landing/Gallery.tsx`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `GALLERY` (Task 3), `useReveal` (Task 4)
- Produces: `export default function Gallery(): JSX.Element`

- [ ] **Step 1: 컴포넌트 작성**

`components/landing/Gallery.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { GALLERY } from './content';
import { useReveal } from './useReveal';

/** 초원 배경 위 폴라로이드 시안 카드 — 맥 창 점 3개가 얹힌 브라우저 카드 모양 */
export default function Gallery() {
  const ref = useReveal<HTMLDivElement>(0.12);
  return (
    <section className="xp-meadow xp-gallery" aria-label="시안 예시">
      <div className="xp-head xp-head-on-photo">
        <span className="xp-pill t-yellow">Looks</span>
        <h2 className="xp-display">이런 시안이 나와요</h2>
      </div>
      <div className="xp-polaroids" ref={ref}>
        {GALLERY.map((g, i) => (
          <figure
            className="xp-polaroid xp-reveal"
            style={{ '--d': `${i * 110}ms`, '--tilt': `${g.tilt}deg` } as CSSProperties}
            key={g.src}
          >
            <div className="xp-polaroid-bar" aria-hidden>
              <i /><i /><i />
            </div>
            <img src={g.src} alt={`시안 예시 — ${g.title}`} width={320} height={320} loading="lazy" decoding="async" />
            <figcaption>
              <strong>{g.title}</strong>
              <span>{g.meta}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 갤러리 (폴라로이드) ────────────────────────────────────── */
.xp-gallery { padding: var(--space-section) clamp(20px, 5vw, 64px); }

.xp-head-on-photo h2 { color: #fff; font-size: clamp(30px, 5.2vw, 58px); }

.xp-polaroids {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: clamp(20px, 3vw, 38px);
  max-width: 980px;
  margin: 0 auto;
}

.xp-polaroid {
  margin: 0;
  padding: 10px 10px 0;
  border-radius: 14px;
  background: var(--paper-card);
  box-shadow: var(--shadow-lift);
  transform: rotate(var(--tilt, 0deg));
  transition: transform 0.3s ease;
}

.xp-polaroid-bar { display: flex; gap: 5px; padding: 4px 4px 9px; }
.xp-polaroid-bar i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line);
}
.xp-polaroid-bar i:nth-child(1) { background: #ff6058; }
.xp-polaroid-bar i:nth-child(2) { background: #ffbd2e; }
.xp-polaroid-bar i:nth-child(3) { background: #28c840; }

.xp-polaroid img {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 8px;
}

.xp-polaroid figcaption {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 4px 14px;
}

.xp-polaroid figcaption strong {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--ink);
}

.xp-polaroid figcaption span { font-size: 11px; color: var(--muted); }

@media (hover: hover) {
  .xp-polaroid:hover { transform: rotate(0deg) translateY(-6px); }
}

@media (prefers-reduced-motion: reduce) {
  .xp-polaroid, .xp-polaroid:hover { transition: none; }
}
```

- [ ] **Step 3: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/Gallery.tsx app/landing.css
git commit -m "feat(landing): 초원 배경 폴라로이드 갤러리 섹션 추가"
```

---

## Task 8: Services 섹션 (파스텔 필 5행)

**Files:**
- Create: `components/landing/Services.tsx`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `SERVICES` (Task 3), `useReveal` (Task 4)
- Produces: `export default function Services(): JSX.Element` — 기존 `HowItWorks`를 대체

- [ ] **Step 1: 컴포넌트 작성**

`components/landing/Services.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { SERVICES } from './content';
import { useReveal } from './useReveal';

/** 이용 흐름 5행 — 참조의 서비스 리스트 자리. 각 행이 파스텔 필 하나. */
export default function Services() {
  const ref = useReveal<HTMLUListElement>();
  return (
    <section className="xp-paper xp-services" aria-label="이용 흐름">
      <div className="xp-head">
        <span className="xp-pill t-purple">Process</span>
        <h2>
          시안이 만들어지는
          <br />
          다섯 단계
        </h2>
      </div>
      <ul className="xp-service-list" ref={ref}>
        {SERVICES.map((s, i) => (
          <li
            className={`xp-service-row xp-reveal t-${s.tone}`}
            style={{ '--d': `${i * 80}ms` } as CSSProperties}
            key={s.no}
          >
            <span className="xp-service-no">{s.no}</span>
            <span className="xp-service-label">{s.label}</span>
            <span className="xp-service-arrow" aria-hidden>→</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 서비스 (이용 흐름) ─────────────────────────────────────── */
.xp-service-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 640px;
  margin: 0 auto;
  list-style: none;
}

.xp-service-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 24px;
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-card);
}

.xp-service-row.t-pink   { background: var(--pastel-pink); }
.xp-service-row.t-blue   { background: var(--pastel-blue); }
.xp-service-row.t-yellow { background: var(--pastel-yellow); }
.xp-service-row.t-green  { background: var(--pastel-green); }
.xp-service-row.t-purple { background: var(--pastel-purple); }

.xp-service-no {
  font-family: var(--font-display);
  font-size: 13px;
  color: rgba(22, 24, 29, 0.4);
}

.xp-service-label {
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink);
  word-break: keep-all;
}

.xp-service-arrow { font-size: 16px; color: rgba(22, 24, 29, 0.45); }
```

- [ ] **Step 3: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/Services.tsx app/landing.css
git commit -m "feat(landing): 이용 흐름 파스텔 필 섹션 추가"
```

---

## Task 9: ToolSection (사진 주입 툴 셸)

**Files:**
- Create: `components/landing/ToolSection.tsx`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `ReactNode` (page.tsx가 주입하는 `toolSlot`)
- Produces: `export default function ToolSection({ children }: { children: ReactNode }): JSX.Element` — `id="tool"` 앵커를 소유한다

- [ ] **Step 1: 컴포넌트 작성**

`components/landing/ToolSection.tsx`:

```tsx
import type { ReactNode } from 'react';

/**
 * 사진 주입 툴을 감싸는 흰 카드 셸.
 * 툴의 상태·핸들러는 app/page.tsx가 소유하고 children으로 주입된다 — 이 컴포넌트는 껍데기다.
 */
export default function ToolSection({ children }: { children: ReactNode }) {
  return (
    <section className="xp-paper xp-tool" id="tool" aria-label="시안 만들기">
      <div className="xp-tool-card">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: 스타일 추가**

`app/landing.css` 맨 끝에 append. 기존 툴 내부 컴포넌트(`.tray`, `.options`, `.cta`)는 globals.css 스타일을 그대로 쓰고, 카드 셸과 헤더만 새로 정의한다.

```css
/* ─── 툴 카드 ────────────────────────────────────────────────── */
.xp-tool { scroll-margin-top: 72px; }

.xp-tool-card {
  display: flex;
  flex-direction: column;
  gap: 20px;
  max-width: 560px;
  margin: 0 auto;
  padding: clamp(26px, 3.4vw, 40px);
  border-radius: var(--radius-card);
  background: var(--paper-card);
  box-shadow: var(--shadow-lift);
}

.xp-tool-head { display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }

.xp-tool-head h2 {
  font-family: var(--font-display);
  font-size: clamp(24px, 3.2vw, 34px);
  line-height: 1.18;
  letter-spacing: -0.02em;
  color: var(--ink);
  word-break: keep-all;
}

/* 툴 안의 보조 문구 — globals.css의 .sub를 덮어쓰지 않고 이 안에서만 조정 */
.xp-tool-card .sub { font-size: 14px; }

.xp-tool-card .cta { margin-top: 4px; }
```

- [ ] **Step 3: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/ToolSection.tsx app/landing.css
git commit -m "feat(landing): 사진 주입 툴 카드 셸 추가"
```

---

## Task 10: Testimonials + FAQ 섹션

**Files:**
- Create: `components/landing/Testimonials.tsx`
- Create: `components/landing/Faq.tsx`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `SCENES`, `FAQS` (Task 3), `useReveal` (Task 4)
- Produces: `export default function Testimonials(): JSX.Element`, `export default function Faq(): JSX.Element`

- [ ] **Step 1: Testimonials 작성**

`components/landing/Testimonials.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { SCENES } from './content';
import { useReveal } from './useReveal';

/**
 * 예상 사용 장면 카드 3장.
 * 실제 고객 후기가 아니므로 섹션 설명에 그 사실을 반드시 남긴다.
 */
export default function Testimonials() {
  const ref = useReveal<HTMLDivElement>(0.12);
  return (
    <section className="xp-paper xp-scenes" aria-label="이렇게 쓰여요">
      <div className="xp-head">
        <span className="xp-pill t-pink">Scenes</span>
        <h2>이렇게 쓰여요</h2>
        <p>아직 출시 전이라 실제 후기 대신, 이달아가 그리는 사용 장면을 적었어요.</p>
      </div>
      <div className="xp-scene-stack" ref={ref}>
        {SCENES.map((s, i) => (
          <article
            className="xp-card xp-scene xp-reveal"
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            key={s.persona}
          >
            <header className="xp-scene-head">
              <span className="xp-scene-avatar" aria-hidden>
                {s.persona.slice(0, 1)}
              </span>
              <span>
                <strong>{s.persona}</strong>
                <em>{s.role}</em>
              </span>
            </header>
            <blockquote>“{s.quote}”</blockquote>
            <p>{s.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Faq 작성**

`components/landing/Faq.tsx`:

```tsx
'use client';

import type { CSSProperties } from 'react';
import { FAQS } from './content';
import { useReveal } from './useReveal';

/** 산개 배치 FAQ 필 — 좌우 엇갈리게 흩뿌린다 */
export default function Faq() {
  const ref = useReveal<HTMLUListElement>();
  return (
    <section className="xp-paper xp-faq" aria-label="자주 묻는 질문">
      <div className="xp-head">
        <span className="xp-pill t-green">FAQ</span>
        <h2>시작하기 전에</h2>
      </div>
      <ul className="xp-faq-list" ref={ref}>
        {FAQS.map((f, i) => (
          <li
            className={`xp-reveal xp-faq-item i${i % 3}`}
            style={{ '--d': `${i * 70}ms` } as CSSProperties}
            key={f.q}
          >
            <span className={`xp-pill t-${f.tone}`}>{f.q}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 사용 장면 카드 ─────────────────────────────────────────── */
.xp-scene-stack {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: clamp(16px, 2.4vw, 26px);
  max-width: 940px;
  margin: 0 auto;
}

.xp-scene { display: flex; flex-direction: column; gap: 12px; }

.xp-scene-head { display: flex; align-items: center; gap: 10px; }

.xp-scene-avatar {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--pastel-blue);
  font-family: var(--font-display);
  font-size: 14px;
  color: var(--ink);
}

.xp-scene-head strong { display: block; font-size: 13.5px; color: var(--ink); }
.xp-scene-head em { font-style: normal; font-size: 11.5px; color: var(--muted); }

.xp-scene blockquote {
  font-family: var(--font-display);
  font-size: clamp(17px, 2vw, 20px);
  line-height: 1.4;
  letter-spacing: -0.01em;
  color: var(--ink);
  word-break: keep-all;
}

.xp-scene > p {
  font-size: 13.5px;
  line-height: 1.75;
  color: var(--muted);
  word-break: keep-all;
}

/* ─── FAQ ────────────────────────────────────────────────────── */
.xp-faq-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14px;
  max-width: 760px;
  margin: 0 auto;
  list-style: none;
}

.xp-faq-item.i0 { transform: translateY(-6px); }
.xp-faq-item.i2 { transform: translateY(8px); }

.xp-faq-item .xp-pill { font-size: 13.5px; padding: 12px 20px; }

@media (max-width: 640px) {
  .xp-faq-item.i0, .xp-faq-item.i2 { transform: none; }
}
```

- [ ] **Step 4: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 5: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/Testimonials.tsx components/landing/Faq.tsx app/landing.css
git commit -m "feat(landing): 사용 장면·FAQ 섹션 추가"
```

---

## Task 11: FooterCta 섹션

**Files:**
- Create: `components/landing/FooterCta.tsx`
- Modify: `app/landing.css` (append)

**Interfaces:**
- Consumes: `currentIssue` (`@/lib/issue`)
- Produces: `export default function FooterCta(): JSX.Element` — 기존 `StoryFooter` 대체

- [ ] **Step 1: 컴포넌트 작성**

`components/landing/FooterCta.tsx`:

```tsx
import { currentIssue } from '@/lib/issue';

/** 초원 배경 초대형 타이포 CTA + 미니 풋터 바 */
export default function FooterCta() {
  const issue = currentIssue();
  return (
    <section className="xp-meadow xp-footer-cta" aria-label="시안 만들러 가기">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue">Ready?</span>
        <h2 className="xp-display xp-footer-title">
          이달의 네일을
          <br />
          먼저 만나요
        </h2>
        <a className="xp-cta xp-cta-light" href="#tool">
          이번 호 시안 만들기
        </a>
      </div>
      <footer className="xp-footer-bar">
        <span>이달아 — AI가 만드는 이달의 네일</span>
        <span suppressHydrationWarning>{issue.label}</span>
      </footer>
    </section>
  );
}
```

- [ ] **Step 2: 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 풋터 CTA ───────────────────────────────────────────────── */
.xp-footer-cta {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 76vh;
  padding: var(--space-section) clamp(20px, 5vw, 64px) 0;
}

.xp-footer-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.xp-footer-title { font-size: clamp(38px, 8vw, 104px); }

.xp-cta-light { background: var(--paper-card); color: var(--ink); }

.xp-footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
  margin-top: clamp(48px, 8vh, 96px);
  padding: 16px clamp(4px, 1vw, 12px);
  border-top: 1px solid rgba(255, 255, 255, 0.35);
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 8px rgba(16, 26, 44, 0.5);
}
```

- [ ] **Step 3: 타입 확인**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 4: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add components/landing/FooterCta.tsx app/landing.css
git commit -m "feat(landing): 초대형 타이포 풋터 CTA 추가"
```

---

## Task 12: Landing 조립 + page.tsx 연결 + 죽은 코드 제거

**Files:**
- Create: `components/landing/Landing.tsx`
- Modify: `app/page.tsx:8-9, 297-339, 342-417`
- Delete: `components/story/StoryLanding.tsx`, `components/story/HowItWorks.tsx`, `components/story/StoryFooter.tsx`, `components/story/hooks.ts`, `components/editorial/Masthead.tsx`
- Modify: `app/globals.css` (죽은 스타일 제거)

**Interfaces:**
- Consumes: `TopBar`(T4), `HeroHand`(T5), `Stats`(T6), `Gallery`(T7), `Services`(T8), `ToolSection`(T9), `Testimonials`·`Faq`(T10), `FooterCta`(T11)
- Produces: `export default function Landing({ toolSlot }: { toolSlot: ReactNode }): JSX.Element`

- [ ] **Step 1: Landing 조립 컴포넌트 작성**

`components/landing/Landing.tsx`:

```tsx
import type { ReactNode } from 'react';
import HeroHand from '@/components/story/HeroHand';
import TopBar from './TopBar';
import Stats from './Stats';
import Gallery from './Gallery';
import Services from './Services';
import ToolSection from './ToolSection';
import Testimonials from './Testimonials';
import Faq from './Faq';
import FooterCta from './FooterCta';

/**
 * phase === 'start'일 때의 원페이지 랜딩.
 * 프레젠테이션 전용 — 툴 상태/핸들러는 app/page.tsx가 소유하고 toolSlot으로 주입한다.
 */
export default function Landing({ toolSlot }: { toolSlot: ReactNode }) {
  return (
    <main className="xp-landing">
      <TopBar />
      <HeroHand />
      <Stats />
      <Gallery />
      <Services />
      <ToolSection>{toolSlot}</ToolSection>
      <Testimonials />
      <Faq />
      <FooterCta />
    </main>
  );
}
```

- [ ] **Step 2: `.xp-landing` 스타일 추가**

`app/landing.css` 맨 끝에 append:

```css
/* ─── 랜딩 루트 ──────────────────────────────────────────────── */
.xp-landing { position: relative; overflow-x: clip; }
```

- [ ] **Step 3: page.tsx의 import 교체**

`app/page.tsx` 8~9행을 교체한다.

```tsx
// 삭제
import Masthead from '@/components/editorial/Masthead';
import StoryLanding from '@/components/story/StoryLanding';

// 추가
import Landing from '@/components/landing/Landing';
```

`Masthead`는 내부 화면(342~417행)에서도 쓰이므로, 해당 위치의 `<Masthead />` 4곳을 모두 삭제한다. 삭제 대상 라인:

- 345행 `<Masthead />` (analyzing/generating 화면)
- 360행 `<Masthead />` (result 화면)
- 394행 `<Masthead />` (blocked-user 화면)
- 408행 `<Masthead />` (blocked-total 화면)

- [ ] **Step 4: toolSlot 마크업 교체**

`app/page.tsx`의 297~339행(`if (phase === 'start') { ... }` 블록)을 아래로 교체한다. 상태·핸들러 참조는 원본과 동일하다.

```tsx
  if (phase === 'start') {
    return (
      <Landing
        toolSlot={
          <>
            <div className="xp-tool-head">
              <span className="xp-pill t-yellow" suppressHydrationWarning>
                Vol.{currentIssue().vol}
              </span>
              {/* h1은 히어로가 차지 — 툴 섹션 헤드라인은 h2 */}
              <h2>
                영감 사진을 올리면,
                <br />
                이달의 시안이 나와요
              </h2>
            </div>
            <p className="sub">사진을 더할수록 디자인이 진화해요 (최대 3장)</p>
            <InspirationTray photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
            {photos.length > 0 && (
              <OptionsPicker
                shape={shape}
                length={length}
                partsIntensity={partsIntensity}
                onShape={setShape}
                onLength={setLength}
                onPartsIntensity={setPartsIntensity}
              />
            )}
            <button className="cta" disabled={photos.length === 0} onClick={generate}>
              이번 호 시안 만들기
            </button>
            {/* 잔여 횟수는 얼마 안 남았을 때만 노출 — 개발용 큰 한도가 그대로 보이는 것 방지 */}
            {remaining !== null && remaining <= 10 && (
              <p className="remaining">오늘 {remaining}회 남음</p>
            )}
            {error && <div className="error-toast">{error}</div>}
          </>
        }
      />
    );
  }
```

- [ ] **Step 5: 죽은 컴포넌트 삭제**

```bash
cd ~/Desktop/projects/nailspo
git rm components/story/StoryLanding.tsx components/story/HowItWorks.tsx \
       components/story/StoryFooter.tsx components/story/hooks.ts \
       components/editorial/Masthead.tsx
rmdir components/editorial 2>/dev/null || true
```

- [ ] **Step 6: 죽은 스타일 삭제**

`app/globals.css`에서 아래를 삭제한다:

- `/* ─── 매스트헤드 (전 화면 공용) ... */` 의 `.masthead`, `.masthead-wordmark`, `.masthead-issue`, `.screen .masthead` (75~95행)
- `/* 편집 섹션 헤더 시스템 ... */` 의 `.section-head`, `.section-meta`, `.section-no`, `.section-meta .overline::after`, `.section-title`, `.section-ghost` (466~516행)
- `.story-hiw`, `.hiw-grid`, `.hiw-col`, `.hiw-num`, `.hiw-col h3`, `.hiw-col p` (517~559행)
- `.reveal`, `.is-revealed .reveal, .is-revealed.reveal` (561~570행) — `.xp-reveal`로 대체됨
- `.story-tool`, `.tool-column`, `.tool-head`, `.tool-head .section-title` (573~595행)
- `.story { position: relative; overflow-x: clip; }` (145행) — `.xp-landing`으로 대체됨
- `/* ─── 푸터 ... */` 의 `.story-footer`, `.footer-credit` (1044~1055행)
- 모바일 블록 안의 `.hiw-grid { ... }` 한 줄과 `.masthead { padding: ... }` 한 줄

- [ ] **Step 7: 죽은 참조가 남지 않았는지 확인**

```bash
cd ~/Desktop/projects/nailspo
grep -rn "StoryLanding\|HowItWorks\|StoryFooter\|Masthead\|story/hooks\|useReveal" \
  --include="*.tsx" --include="*.ts" app components tests
```

Expected: `components/landing/` 안의 `useReveal` import 5건(Stats·Gallery·Services·Testimonials·Faq)과 `useReveal.ts` 정의 1건만 출력. `StoryLanding`/`HowItWorks`/`StoryFooter`/`Masthead`는 0건.

```bash
cd ~/Desktop/projects/nailspo
grep -rn "section-title\|section-head\|section-ghost\|story-hiw\|hiw-\|\.story\b\|tool-column\|story-footer\|masthead\|ticker" \
  --include="*.tsx" app components
```

Expected: 출력 없음 (exit 1)

- [ ] **Step 8: 타입 검사와 전체 테스트**

```bash
cd ~/Desktop/projects/nailspo && npx tsc --noEmit && npx vitest run
```

Expected: tsc exit 0, vitest 전체 통과 (기존 195개 + 신규 8개 = 203개)

- [ ] **Step 9: 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add -A app components
git commit -m "feat(landing): 새 랜딩 조립 및 잡지 스타일 컴포넌트 제거"
```

---

## Task 13: 내부 화면 정합 + 최종 검증

**Files:**
- Modify: `app/globals.css` (`.screen`, `.headline`, `.overline` 등 잔여 규칙 조정)
- Modify: `components/GeneratingScreen.tsx`, `components/ResultScreen.tsx` (필요 시 클래스 정리)

**Interfaces:**
- Consumes: Task 2의 디자인 토큰
- Produces: 없음 (검증 태스크)

- [ ] **Step 1: 내부 화면에서 깨진 클래스 참조 확인**

```bash
cd ~/Desktop/projects/nailspo
grep -rn "className=\"[^\"]*\"" components/GeneratingScreen.tsx components/ResultScreen.tsx \
  | grep -o "className=\"[^\"]*\"" | tr ' ' '\n' | tr -d '"' | sed 's/className=//' | sort -u
```

출력된 각 클래스가 `app/globals.css`에 여전히 정의돼 있는지 확인한다. Task 12에서 삭제한 `.section-head`·`.section-title`·`.reveal` 계열을 쓰는 곳이 있으면 해당 마크업을 아래 규칙으로 바꾼다:

- `.section-head` → 삭제하고 `.pick-head` 또는 단순 `<p className="overline">`만 남긴다
- `.section-title` → `.headline`
- `.reveal` → 삭제 (내부 화면은 reveal 애니메이션을 쓰지 않는다)

- [ ] **Step 2: `.screen` 컨테이너에 상단 여백 확보**

`Masthead`가 사라졌으므로 내부 화면 상단이 붙는다. `app/globals.css`의 `.screen` 규칙에 패딩을 더한다.

```bash
cd ~/Desktop/projects/nailspo && sed -n '/^\.screen {/,/^}/p' app/globals.css
```

출력된 블록의 `padding` 값에서 상단 값을 `clamp(64px, 9vh, 96px)`로 올린다. 예를 들어 원래가 `padding: 28px clamp(22px, 5vw, 56px) 64px;`였다면:

```css
  padding: clamp(64px, 9vh, 96px) clamp(22px, 5vw, 56px) 64px;
```

- [ ] **Step 3: 프로덕션 빌드**

```bash
cd ~/Desktop/projects/nailspo && npx next build
```

Expected: `✓ Compiled successfully` 출력, 에러 0

- [ ] **Step 4: 전체 테스트**

```bash
cd ~/Desktop/projects/nailspo && npx vitest run
```

Expected: 203개 전부 통과

- [ ] **Step 5: 브라우저 육안 검증**

```bash
cd ~/Desktop/projects/nailspo && npx next dev
```

브라우저에서 `http://localhost:3000`을 열고 아래를 순서대로 확인한다. 하나라도 실패하면 고치고 이 단계를 다시 실행한다.

1. 히어로에 초원 배경이 깔리고 흰 대형 헤드라인과 파스텔 필 3개가 보인다
2. **손 변신 애니메이션이 돈다** — 카드 4장이 뜬 뒤 구슬이 되어 손 주위를 돌고, 손톱부터 원형으로 디자인 손톱이 번진다 (약 12초 루프)
3. 스크롤 시 통계 카드 4장 → 초원 갤러리 폴라로이드 4장 → 파스텔 필 5행이 순서대로 나온다
4. 상단 바의 "시안 만들기"를 누르면 툴 카드로 부드럽게 이동한다
5. **사진 주입이 동작한다** — 사진 1장을 올리면 옵션 픽커가 나타나고, "이번 호 시안 만들기"가 활성화된다
6. 생성 버튼을 눌러 생성 화면으로 넘어가고, 상단이 잘리지 않는다
7. 사용 장면 카드 3장, FAQ 필 6개, 초대형 풋터 CTA가 보인다
8. 브라우저 너비를 375px로 줄여도 가로 스크롤이 생기지 않고 구슬이 잘리지 않는다
9. 콘솔에 에러·하이드레이션 경고가 없다

- [ ] **Step 6: 참조 이미지와 나란히 비교**

`~/Desktop/SCR-20260804-sxcg.jpeg`를 열어 랜딩 전체 스크린샷과 비교한다. 배경 질감·카드 라운드·필 색감·타이포 굵기가 같은 계열인지 확인하고, 어긋나는 값은 `app/landing.css`에서 조정한다.

- [ ] **Step 7: 최종 커밋**

```bash
cd ~/Desktop/projects/nailspo
git add -A
git commit -m "fix(landing): 내부 화면 토큰 정합 및 최종 검증 반영"
```

---

## 완료 기준

- [ ] `npx next build` 성공
- [ ] `npx vitest run` 203개 통과
- [ ] 히어로 손 변신 애니메이션이 리디자인 전과 동일하게 동작
- [ ] 사진 업로드 → 생성 → 결과 플로우가 리디자인 전과 동일하게 동작
- [ ] 375px 폭에서 가로 스크롤 없음
- [ ] 콘솔 에러·하이드레이션 경고 0
- [ ] `docs/landing-assets.md`에 배경 사진 출처 기록됨
