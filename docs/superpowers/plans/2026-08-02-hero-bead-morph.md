# 히어로 구슬 변신 연출 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No.02 BeadMorph의 구슬 애니메이션을 히어로로 통합 — 영감 카드 4장이 구슬이 되어 맨손을 감싸고 돌다 손톱으로 스며들며 디자인 손톱으로 재탄생하는 무한 루프 연출.

**Architecture:** 순수 타임라인 모듈(`heroMorph.ts`, 유닛 테스트 대상) + `HeroHand` 컴포넌트의 rAF 루프(DOM 스타일 직접 조작, BeadMorph와 같은 방식) + Gemini/Seedream 파이프라인으로 생성한 정렬된 "변신 후 손" 에셋. 기존 No.02 섹션은 삭제.

**Tech Stack:** Next.js 15, React 19, vitest, sharp, `lib/provider.ts`의 `generateImage`

**설계 문서:** `docs/superpowers/specs/2026-08-02-hero-bead-morph-design.md`

## Global Constraints

- 모든 주석·커밋 메시지는 한국어
- 금지 모티프(2026-07-31 확정): 3D 음식 참(도넛·캔디·케이크·과일), 리본, 매달린 참, 과대 파츠, 캐릭터 — 프롬프트에 명시
- 변신 후 손은 `hand.webp`(1000×1796, 알파)와 같은 손·같은 포즈·같은 크기로 정렬되어야 함 — **Task 2의 정렬 게이트 통과 전 Task 3 착수 금지**
- `prefers-reduced-motion`: 애니메이션 없이 완성 손 정지 이미지
- 루프 타이밍(승인됨): 정지 2s → 소용돌이 3s → 흡수 0.8s → 재탄생 0.9s → 완성 정지 4s → 복귀 0.8s = 11.5s
- 커밋 말미: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`

---

### Task 1: 타임라인 모듈 `heroMorph.ts` (TDD)

**Files:**
- Create: `components/story/heroMorph.ts`
- Test: `tests/heroMorph.test.ts`

**Interfaces:**
- Produces: `MORPH` (페이즈 길이 상수), `MORPH_TOTAL = 11500`, `interface MorphFrame`, `frameAt(tMs: number): MorphFrame` — Task 3의 `HeroHand`가 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/heroInspo.test.ts`와 같은 스타일(`@/` 별칭, vitest).

```ts
// tests/heroMorph.test.ts
import { describe, it, expect } from 'vitest';
import { frameAt, MORPH, MORPH_TOTAL } from '@/components/story/heroMorph';

const e1 = MORPH.holdStart;
const e2 = e1 + MORPH.swirl;
const e3 = e2 + MORPH.absorb;
const e4 = e3 + MORPH.reveal;
const e5 = e4 + MORPH.holdEnd;

describe('frameAt — 히어로 변신 타임라인', () => {
  it('전체 길이는 11.5초', () => {
    expect(MORPH_TOTAL).toBe(11500);
    expect(e5 + MORPH.back).toBe(MORPH_TOTAL);
  });

  it('정지 구간: 카드만 보이고 구슬·리빌 없음', () => {
    const f = frameAt(0);
    expect(f.cardAlpha).toBe(1);
    expect(f.beadAlpha).toBe(0);
    expect(f.reveal).toBe(0);
  });

  it('소용돌이 중반: 구슬이 보이고 카드는 사라짐', () => {
    const f = frameAt(e1 + MORPH.swirl / 2);
    expect(f.beadAlpha).toBe(1);
    expect(f.cardAlpha).toBe(0);
    expect(f.orbitR).toBeGreaterThan(0);
  });

  it('흡수 끝: 궤도 반경 0, 중심이 손톱 쪽(y 0.18)으로 이동', () => {
    const f = frameAt(e3 - 1);
    expect(f.orbitR).toBeCloseTo(0, 1);
    expect(f.center.y).toBeCloseTo(0.18, 1);
  });

  it('재탄생 구간에서 reveal이 단조 증가', () => {
    const a = frameAt(e3 + MORPH.reveal * 0.25).reveal;
    const b = frameAt(e3 + MORPH.reveal * 0.75).reveal;
    expect(b).toBeGreaterThan(a);
  });

  it('완성 정지: reveal 1, 카드·구슬 없음', () => {
    const f = frameAt(e4 + MORPH.holdEnd / 2);
    expect(f.reveal).toBe(1);
    expect(f.cardAlpha).toBe(0);
    expect(f.beadAlpha).toBe(0);
  });

  it('복귀 끝 무렵: 카드가 돌아오고 reveal이 줄어듦', () => {
    const f = frameAt(e5 + MORPH.back * 0.9);
    expect(f.cardAlpha).toBeGreaterThan(0.5);
    expect(f.reveal).toBeLessThan(0.5);
  });

  it('루프: TOTAL을 넘긴 시각은 나머지 시각과 같은 프레임', () => {
    expect(frameAt(MORPH_TOTAL + 10)).toEqual(frameAt(10));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/heroMorph.test.ts`
Expected: FAIL — `Cannot find module '@/components/story/heroMorph'`

- [ ] **Step 3: 구현**

```ts
// components/story/heroMorph.ts
/**
 * 히어로 변신 루프의 순수 타임라인 — 시각(ms) → 프레임 상태.
 * DOM을 모르는 순수 함수라 유닛 테스트 가능. 렌더는 HeroHand가 담당.
 */
export const MORPH = {
  holdStart: 2000, // 맨손 + 영감 카드 정지
  swirl: 3000,     // 카드가 구슬이 되어 손 주위 소용돌이
  absorb: 800,     // 구슬이 손톱 쪽으로 빨려 들어감
  reveal: 900,     // 손톱부터 원형으로 완성 손 리빌
  holdEnd: 4000,   // 완성 정지 (CTA 읽을 시간)
  back: 800,       // 맨손 + 카드로 복귀
} as const;

export const MORPH_TOTAL =
  MORPH.holdStart + MORPH.swirl + MORPH.absorb + MORPH.reveal + MORPH.holdEnd + MORPH.back;

export interface MorphFrame {
  /** 영감 카드(라벨 박스) 불투명도 */
  cardAlpha: number;
  /** 구슬 불투명도 */
  beadAlpha: number;
  /** 구슬 크기 배율 */
  beadScale: number;
  /** 궤도 반경 — 무대 너비 대비 비율 */
  orbitR: number;
  /** 누적 회전(라디안) */
  spin: number;
  /** 플래시 강도 */
  flash: number;
  /** 완성 손 리빌 진행도 0..1 */
  reveal: number;
  /** 궤도 중심 — 무대 크기 대비 비율 (흡수 때 손톱 쪽으로 이동) */
  center: { x: number; y: number };
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** 손톱 무리의 무대 내 상대 위치 — hand.webp에서 손톱은 상단에 있다 */
const NAIL_Y = 0.18;

export function frameAt(tMs: number): MorphFrame {
  const t = ((tMs % MORPH_TOTAL) + MORPH_TOTAL) % MORPH_TOTAL;
  const f: MorphFrame = {
    cardAlpha: 1, beadAlpha: 0, beadScale: 1, orbitR: 0,
    spin: 0, flash: 0, reveal: 0, center: { x: 0.5, y: 0.5 },
  };
  const e1 = MORPH.holdStart;
  const e2 = e1 + MORPH.swirl;
  const e3 = e2 + MORPH.absorb;
  const e4 = e3 + MORPH.reveal;
  const e5 = e4 + MORPH.holdEnd;

  if (t < e1) return f; // 정지 — 현재 히어로 그대로

  if (t < e2) { // 소용돌이
    const u = (t - e1) / MORPH.swirl;
    f.cardAlpha = 1 - clamp01(u * 3); // 초반에 빠르게 카드 → 구슬 교대
    f.beadAlpha = clamp01(u * 3);
    f.orbitR = lerp(0.42, 0.28, easeOut(clamp01(u * 1.4)));
    f.spin = easeInOut(u) * Math.PI * 2.4;
    return f;
  }

  if (t < e3) { // 흡수 — 손톱 쪽으로 빨려 들어감
    const u = easeInOut((t - e2) / MORPH.absorb);
    f.cardAlpha = 0;
    f.beadAlpha = 1 - clamp01((u - 0.7) / 0.3); // 막판에만 사라짐
    f.beadScale = lerp(1, 0.24, u);
    f.orbitR = lerp(0.28, 0, u);
    f.spin = Math.PI * 2.4 + u * 0.8;
    f.center = { x: 0.5, y: lerp(0.5, NAIL_Y, u) };
    f.flash = u * 0.5;
    return f;
  }

  if (t < e4) { // 재탄생 — 손톱부터 원형 리빌
    const u = (t - e3) / MORPH.reveal;
    f.cardAlpha = 0;
    f.reveal = easeInOut(u);
    f.flash = 0.5 * (1 - u);
    f.center = { x: 0.5, y: NAIL_Y };
    return f;
  }

  if (t < e5) { // 완성 정지
    f.cardAlpha = 0;
    f.reveal = 1;
    return f;
  }

  // 복귀
  const u = easeInOut((t - e5) / MORPH.back);
  f.reveal = 1 - u;
  f.cardAlpha = u;
  return f;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/heroMorph.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: 커밋**

```bash
git add components/story/heroMorph.ts tests/heroMorph.test.ts
git commit -m "feat: 히어로 변신 루프 타임라인 모듈 추가

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: "변신 후 손" 에셋 생성 + 정렬 게이트

**Files:**
- Create: `scripts/generate-hand-after.mts`
- Create(산출물): `public/hero/hand-after.webp`, `ref/hand-after-check.png`

**Interfaces:**
- Consumes: `lib/provider.ts`의 `generateImage(images: ImagePayload[], prompt: string): Promise<ImageOutcome>`
- Produces: `public/hero/hand-after.webp` — `hand.webp`와 동일 크기(1000×1796)·동일 정렬·알파 포함. Task 3이 그대로 겹쳐 배치.

- [ ] **Step 1: 생성 스크립트 작성**

`generate-hero-hand.mts`의 크로마 키아웃을 재사용하되, **트림하지 않고** 원본 크기로 맞춰 정렬을 보존한다.

```ts
// scripts/generate-hand-after.mts
/**
 * 히어로 "변신 후 손" 생성 (일회성, 산출물 커밋).
 *   npx tsx scripts/generate-hand-after.mts
 * hand.webp(맨손)를 입력으로 같은 손·같은 포즈에 손톱 디자인만 얹은 이미지를 생성.
 * 크로마 그린으로 플래튼해 보내고, 결과를 키아웃한 뒤 **트림 없이** 원본과
 * 같은 1000×1796으로 저장해 픽셀 정렬을 보존한다.
 * 정렬 검증용 오버레이(ref/hand-after-check.png)를 함께 만든다 — 손 외곽이
 * 이중으로 보이면 재실행.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { generateImage } from '../lib/provider.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'public/hero/hand.webp');
const OUT = resolve(ROOT, 'public/hero/hand-after.webp');
const CHECK = resolve(ROOT, 'ref/hand-after-check.png');

for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
delete process.env.GEMINI_MOCK;
delete process.env.SEEDREAM_MOCK;

// 트렌드는 질감·효과로만 서술(음식·파츠 명사 금지) — 2026-07-31 품질 규칙
const PROMPT = [
  'Edit this photo of a bare hand on a green screen background.',
  'Keep EVERYTHING pixel-identical: same hand, same pose, same finger positions,',
  'same skin tone, same lighting, same framing, same solid green background.',
  "Only change: apply this month's K-nail trend design to the five fingernails —",
  'glazed glossy sheen, soft chrome shimmer, subtle aurora film gradient in muted pastel tones.',
  'Nails keep their natural short length and stay naturally attached to the fingers.',
  'Banned: 3D food charms (donut, candy, cake, fruit), ribbon bows, dangling charms,',
  'oversized 3D parts, cartoon characters, text, watermark, jewelry.',
  'Photorealistic, high detail.',
].join(' ');

/** generate-hero-hand.mts와 동일한 크로마 그린 키아웃 (일회성 스크립트라 복사 유지) */
function keyOutGreen(raw: Buffer, w: number, h: number, channels: number): Buffer {
  const HI = 45, LO = 12;
  const out = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const p = i * channels;
    let r = raw[p], g = raw[p + 1], b = raw[p + 2];
    const gm = g - Math.max(r, b);
    let a: number;
    if (gm >= HI) a = 0;
    else if (gm <= LO) a = 255;
    else a = Math.round((255 * (HI - gm)) / (HI - LO));
    const maxRB = Math.max(r, b);
    if (g > maxRB) g = maxRB;
    if (a === 0) { r = 0; g = 0; b = 0; }
    out[i * 4] = r; out[i * 4 + 1] = g; out[i * 4 + 2] = b; out[i * 4 + 3] = a;
  }
  return out;
}

async function run() {
  mkdirSync(dirname(CHECK), { recursive: true });
  const meta = await sharp(SRC).metadata();
  const W = meta.width!, H = meta.height!; // 1000×1796

  // 알파 → 크로마 그린 플래튼 (모델 입력용)
  const flat = await sharp(SRC).flatten({ background: { r: 0, g: 177, b: 64 } }).png().toBuffer();
  console.log('변신 후 손 생성 중… (공급자:', process.env.IMAGE_PROVIDER ?? 'gemini', ')');
  const outcome = await generateImage([{ data: flat.toString('base64'), mimeType: 'image/png' }], PROMPT);
  if (outcome.safetyBlocked) throw new Error('세이프티 차단됨 — 재실행');
  if (!outcome.image) throw new Error('이미지가 반환되지 않음');

  // 키아웃 → 트림 없이 원본 크기로 강제(정렬 보존)
  const gen = sharp(Buffer.from(outcome.image.data, 'base64')).resize(W, H, { fit: 'fill' });
  const { data, info } = await gen.raw().toBuffer({ resolveWithObject: true });
  const rgba = keyOutGreen(data, info.width, info.height, info.channels);
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(OUT);
  console.log('생성 완료:', OUT);

  // 정렬 검증 오버레이 — 원본 위에 결과를 55% 불투명도로 겹침
  const after = await sharp(OUT).ensureAlpha().png().toBuffer();
  const ghost = await sharp(after)
    .composite([{ input: Buffer.from([255, 255, 255, 115]), raw: { width: 1, height: 1, channels: 4 }, tile: true, blend: 'dest-in' }])
    .png().toBuffer();
  await sharp(SRC).ensureAlpha()
    .composite([{ input: ghost, blend: 'over' }])
    .flatten({ background: '#fcfaf7' })
    .png().toFile(CHECK);
  console.log('정렬 검증 이미지:', CHECK, '(손 외곽이 이중으로 보이면 재실행)');
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
```

- [ ] **Step 2: 실행**

Run: `npx tsx scripts/generate-hand-after.mts`
Expected: `생성 완료: …/public/hero/hand-after.webp` + `정렬 검증 이미지: …/ref/hand-after-check.png`

- [ ] **Step 3: 정렬 게이트 (필수)**

`ref/hand-after-check.png`와 `public/hero/hand-after.webp`를 눈으로 확인:
1. 손 외곽·손가락 위치가 원본과 겹치는가 (이중 윤곽 없음)
2. 손톱이 손가락에 자연스럽게 붙어 있는가
3. 금지 모티프(도넛·리본 등) 없음, 질감 중심 디자인인가

**하나라도 실패하면 Step 2 재실행 (모델 랜덤성으로 후보 비교). 통과 전 Task 3 착수 금지.** 3회 이상 실패 시 사용자에게 후보 이미지를 보여주고 선택받는다.

- [ ] **Step 4: 커밋**

```bash
git add scripts/generate-hand-after.mts public/hero/hand-after.webp
git commit -m "feat: 히어로 변신 후 손 에셋 생성 (hand.webp 정렬 보존)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: HeroHand에 변신 루프 통합 + CSS

**Files:**
- Modify: `components/story/HeroHand.tsx` (전체 교체, 아래 코드)
- Modify: `app/globals.css` — `.inspo-cut.at-bottom-right` 블록(약 331행) 아래에 신규 클래스 추가, 파일 끝 `prefers-reduced-motion` 블록(약 947행 근처)에 한 줄 추가

**Interfaces:**
- Consumes: Task 1의 `frameAt`, `MORPH_TOTAL`, `MorphFrame`; Task 2의 `/hero/hand-after.webp`
- Produces: 히어로 무한 루프 연출 (외부 소비자 없음)

- [ ] **Step 1: HeroHand.tsx 전체 교체**

```tsx
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Masthead from '@/components/editorial/Masthead';
import { currentIssue } from '@/lib/issue';
import { HERO_INSPO } from './heroInspo';
import { frameAt, MORPH_TOTAL } from './heroMorph';

const AFTER_SRC = '/hero/hand-after.webp';

/**
 * 표지 — 발행호 + 세리프 헤드라인 + 변신 루프 무대.
 * 영감 카드 4장이 구슬이 되어 맨손을 감싸고 돌다 손톱으로 스며들면
 * 맨손톱이 이달의 디자인 손톱으로 재탄생한다(heroMorph 타임라인, 무한 루프).
 */
export default function HeroHand() {
  const issue = currentIssue();
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const beadRefs = useRef<(HTMLDivElement | null)[]>([]);
  const afterRef = useRef<HTMLImageElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const t0 = useRef(0);
  const pausedAt = useRef(0);
  const [reduced, setReduced] = useState(false);

  const applyFrame = useCallback((tMs: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const f = frameAt(tMs);
    const W = stage.clientWidth, H = stage.clientHeight;
    const cx = W * f.center.x, cy = H * f.center.y;
    const N = HERO_INSPO.length;

    beadRefs.current.forEach((el, i) => {
      if (!el) return;
      const ang = (i / N) * Math.PI * 2 + f.spin;
      // 반경에 구슬별 위상 흔들림 — 기계적 등속 원운동 탈피 (BeadMorph에서 이식)
      const wob = 1 + 0.06 * Math.sin(f.spin * 2 + i * 1.7);
      const x = cx + Math.cos(ang) * W * f.orbitR * wob;
      const y = cy + Math.sin(ang) * W * f.orbitR * wob * 0.72; // 타원 궤도
      const s = el.offsetWidth || 1;
      el.style.transform = `translate(${x - s / 2}px, ${y - s / 2}px) scale(${f.beadScale})`;
      el.style.opacity = String(f.beadAlpha);
    });

    cardRefs.current.forEach((el) => {
      if (!el) return;
      // 입장 애니메이션(fill: forwards)이 인라인 opacity를 이기므로 루프 시작 후 해제
      el.style.animation = 'none';
      el.style.opacity = String(f.cardAlpha);
    });

    const after = afterRef.current;
    if (after) {
      after.style.opacity = f.reveal > 0 ? '1' : '0';
      // 손톱 무리(상단 중앙)에서 원형으로 번짐 — 120%면 손 전체를 덮는다
      after.style.clipPath = `circle(${(f.reveal * 120).toFixed(2)}% at 50% 18%)`;
    }
    if (flashRef.current) flashRef.current.style.opacity = String(f.flash);
  }, []);

  const loop = useCallback(() => {
    const tick = (now: number) => {
      applyFrame((now - t0.current) % MORPH_TOTAL);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyFrame]);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setReduced(true); return; }
    t0.current = performance.now();
    loop();
    // 백그라운드 탭이면 일시정지 (배터리 배려)
    const onVis = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
        pausedAt.current = performance.now();
      } else {
        t0.current += performance.now() - pausedAt.current;
        loop();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(rafRef.current);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [loop]);

  return (
    <section className="story-hero" aria-label="이달아 — 이달의 네일 아트">
      {/* 아트프린트 등록(크롭) 마크 — 네 모서리 */}
      <div className="hero-marks" aria-hidden><i /><i /><i /><i /></div>
      {/* 거대한 고스트 발행호 숫자 — 편집 워터마크 */}
      <span className="hero-volnum" aria-hidden suppressHydrationWarning>
        {String(issue.vol).padStart(2, '0')}
      </span>
      {/* 표지 커버라인 — 잡지 표지 문구 */}
      <span className="coverline cl-left" aria-hidden>
        K-Nail Trend Report — <em>Glazed · Chrome · 3D</em>
      </span>
      <span className="coverline cl-right" aria-hidden>
        Your Photo,
        <br />
        <em>This Month&apos;s Nails</em>
      </span>
      {/* 바코드 + 가격 — 진짜 발행물 장치 */}
      <div className="hero-issue-tag" aria-hidden>
        <span className="barcode" />
        <span className="issue-price" suppressHydrationWarning>
          FREE ISSUE · <em>₩0</em>
        </span>
      </div>
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
          {/* 변신 후 손 — 맨손과 같은 크기로 겹쳐 두고 손톱부터 원형 리빌 */}
          <img
            className={`hand-after${reduced ? ' is-static' : ''}`}
            ref={afterRef}
            src={AFTER_SRC}
            alt=""
            width={500}
            height={898}
            loading="eager"
            decoding="async"
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
      </div>
      <div className="hero-cue" aria-hidden>
        Scroll
      </div>
    </section>
  );
}
```

주의: `reduced`일 때는 rAF 루프가 돌지 않으므로 카드의 입장 애니메이션·opacity는 기존 CSS 그대로 유지되고, `.hand-after.is-static`이 완성 손을 정지 표시한다.

- [ ] **Step 2: globals.css에 신규 클래스 추가**

`.inspo-cut.at-bottom-right { … }` 블록 바로 아래에 추가:

```css
/* 변신 후 손 — 맨손과 같은 자리에 겹쳐 두고 손톱부터 원형 리빌(clip-path) */
.hand-after {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  height: 100%;
  width: auto;
  max-width: none;
  z-index: 1; /* hand-img와 같은 층 — DOM 순서로 위에 얹힘 */
  opacity: 0;
  will-change: clip-path, opacity;
}
.hand-after.is-static { opacity: 1; }

/* 히어로 구슬 — 영감 사진이 광택 구슬로 변해 손 주위를 돈다 */
.hero-bead {
  position: absolute;
  left: 0;
  top: 0;
  z-index: 3;
  width: clamp(56px, 16%, 84px);
  aspect-ratio: 1;
  border-radius: 50%;
  overflow: hidden;
  opacity: 0;
  pointer-events: none;
  will-change: transform, opacity;
  box-shadow: 0 10px 24px rgba(20, 18, 30, 0.18);
}
.hero-bead img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
/* 유리 광택 하이라이트 */
.hero-bead::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background:
    radial-gradient(circle at 30% 26%, rgba(255, 255, 255, 0.85) 0 8%, rgba(255, 255, 255, 0) 32%),
    radial-gradient(circle at 70% 80%, rgba(255, 255, 255, 0.25) 0 12%, rgba(255, 255, 255, 0) 40%);
}

/* 흡수 순간의 은은한 광 — 손톱 무리 주변 */
.hero-flash {
  position: absolute;
  inset: -10%;
  z-index: 2;
  background: radial-gradient(circle at 50% 22%, rgba(255, 250, 235, 0.9), rgba(255, 250, 235, 0) 55%);
  opacity: 0;
  pointer-events: none;
}
```

기존 `@media (prefers-reduced-motion: reduce)` 블록(약 947행, `.hand-img, .inspo-cut { animation: none; … }` 있는 곳)에 한 줄 추가:

```css
  .hero-bead, .hero-flash { display: none; }
```

- [ ] **Step 3: 타입·기존 테스트 확인**

Run: `npm run typecheck && npm run test`
Expected: 둘 다 PASS

- [ ] **Step 4: 브라우저 확인 (개발 서버 + Playwright)**

`npm run dev`가 떠 있는 상태에서 `http://localhost:3000` 접속, 루프 단계별 스크린샷:
- t≈1s: 맨손 + 카드 4장 (기존 모습)
- t≈4s: 구슬 4개가 손 주위 궤도
- t≈6s: 플래시 + 손톱 리빌 시작
- t≈8s: 디자인 손톱 완성 정지
콘솔 에러 0건 확인.

- [ ] **Step 5: 커밋**

```bash
git add components/story/HeroHand.tsx app/globals.css
git commit -m "feat: 히어로에 구슬 변신 무한 루프 연출 통합

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: No.02 BeadMorph 섹션 삭제 + 섹션 번호 당김

**Files:**
- Delete: `components/story/BeadMorph.tsx`, `scripts/generate-hero-beforeafter.mts`, `public/hero/ba-before.webp`, `public/hero/ba-after.webp`
- Modify: `components/story/StoryLanding.tsx`, `app/page.tsx:139`, `app/globals.css`(`.morph-*` 블록)

**Interfaces:**
- Consumes: 없음
- Produces: 없음 (제거 작업)

- [ ] **Step 1: StoryLanding에서 BeadMorph 제거 + 고스트 번호 당김**

`components/story/StoryLanding.tsx`에서:
- `import BeadMorph from './BeadMorph';` 줄 삭제
- `<BeadMorph />` 줄 삭제
- 툴 섹션의 `<span className="section-ghost" aria-hidden>03</span>` → `02`

- [ ] **Step 2: page.tsx 섹션 번호 당김**

`app/page.tsx` 툴 섹션 헤드(약 139행): `<span className="section-no">No.03</span>` → `No.02`

- [ ] **Step 3: 파일·에셋 삭제**

```bash
git rm components/story/BeadMorph.tsx scripts/generate-hero-beforeafter.mts public/hero/ba-before.webp public/hero/ba-after.webp
```

- [ ] **Step 4: morph-* CSS 삭제**

`app/globals.css`에서 `.morph-stage`부터 `.morph-replay:hover`까지의 블록(약 519–595행, 셀렉터 `.morph-stage`, `.morph-bead`, `.morph-bead img`, `.morph-bead::after`, `.morph-result`, `.morph-result.morph-static`, `.morph-flash`, `.morph-replay`, `.morph-replay:hover`와 `story-morph` 관련 규칙) 전부 삭제. 삭제 후 확인:

```bash
grep -n "morph" app/globals.css
```
Expected: 출력 없음 (또는 hero-morph 무관 잔재 없음)

- [ ] **Step 5: 잔여 참조 확인 + 타입·테스트**

```bash
grep -rn "BeadMorph\|ba-before\|ba-after\|story-morph" app components lib tests
npm run typecheck && npm run test
```
Expected: grep 출력 없음, typecheck·test PASS

- [ ] **Step 6: 브라우저 확인**

페이지 전체 스크롤: 히어로 → 티커 → No.01(HowItWorks) → No.02(툴) → 푸터 순서, 빈 공간·깨진 이미지 없음.

- [ ] **Step 7: 커밋**

```bash
git add -A
git commit -m "refactor: No.02 BeadMorph 섹션 삭제 — 히어로 연출로 통합, 섹션 번호 당김

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 통합 검증

**Files:** 없음 (검증만)

- [ ] **Step 1: 전체 테스트·타입체크**

Run: `npm run typecheck && npm run test`
Expected: PASS

- [ ] **Step 2: 루프 연출 단계별 스크린샷**

Playwright로 `http://localhost:3000`에서 루프 1회(11.5초)를 시간대별로 캡처해 사용자에게 보여준다: 정지(카드) → 소용돌이(구슬) → 플래시 → 완성 손 → 복귀. 콘솔 에러 0건.

- [ ] **Step 3: reduced-motion 폴백 확인**

Playwright에서 `prefers-reduced-motion: reduce` 에뮬레이션 후 접속 → 구슬·플래시 없이 완성 손(`hand-after`)이 정지 표시되는지 스크린샷 확인.

- [ ] **Step 4: 백그라운드 일시정지 스모크**

탭 비활성 → 재활성 시 루프가 이어서 재생되는지(에러 없이) 확인.
