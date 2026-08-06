'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIssue } from '@/lib/useIssue';
import { HERO_INSPO } from './heroInspo';
import { beadLayoutAt, frameAt, MORPH, MORPH_TOTAL, NAIL_Y } from './heroMorph';

const AFTER_SRC = '/hero/hand-after.webp';

/**
 * 표지 — 발행호 + 세리프 헤드라인 + 변신 루프 무대.
 * 영감 카드 4장이 구슬이 되어 맨손을 감싸고 돌다 손톱으로 스며들면
 * 맨손톱이 이달의 디자인 손톱으로 재탄생한다(heroMorph 타임라인, 무한 루프).
 */
export default function HeroHand() {
  const issue = useIssue();
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const beadRefs = useRef<(HTMLDivElement | null)[]>([]);
  const afterRef = useRef<HTMLImageElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const t0 = useRef(0);
  const pausedAt = useRef(0);
  // 카드 입장 애니메이션(CSS, forwards)이 끝날 때까지는 카드에 손대지 않는다 — 첫 사이클 정지 구간 한정
  const cardsOwnedByLoop = useRef(false);
  // 정지 구간(holdStart·holdEnd)에는 프레임 값이 그대로 반복돼 매 프레임 같은 값을 다시 써봤자
  // 낭비다 — 직전 프레임과 얕은 비교해 같으면 DOM 쓰기를 건너뛴다. 무대 크기(W·H)는 구슬
  // 위치 계산에 쓰이므로 반드시 비교에 포함해 리사이즈 시에는 값이 같아도 다시 그리게 한다.
  const lastFrameRef = useRef<{
    cardAlpha: number; beadAlpha: number; beadScale: number; orbitR: number;
    spin: number; flash: number; reveal: number; cx: number; cy: number; W: number; H: number;
  } | null>(null);
  const [reduced, setReduced] = useState(false);

  const applyFrame = useCallback((tMs: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const f = frameAt(tMs);
    const W = stage.clientWidth, H = stage.clientHeight;
    const cur = {
      cardAlpha: f.cardAlpha, beadAlpha: f.beadAlpha, beadScale: f.beadScale, orbitR: f.orbitR,
      spin: f.spin, flash: f.flash, reveal: f.reveal, cx: f.center.x, cy: f.center.y, W, H,
    };
    const prev = lastFrameRef.current;
    if (
      prev && prev.cardAlpha === cur.cardAlpha && prev.beadAlpha === cur.beadAlpha &&
      prev.beadScale === cur.beadScale && prev.orbitR === cur.orbitR && prev.spin === cur.spin &&
      prev.flash === cur.flash && prev.reveal === cur.reveal && prev.cx === cur.cx &&
      prev.cy === cur.cy && prev.W === cur.W && prev.H === cur.H
    ) {
      return;
    }
    lastFrameRef.current = cur;
    const cx = W * f.center.x, cy = H * f.center.y;
    const N = HERO_INSPO.length;

    beadRefs.current.forEach((el, i) => {
      if (!el) return;
      // 깊이(원근) 레이아웃 — 뒤쪽 구슬은 손보다 뒤에서 작고 흐릿하게, 앞쪽은 손보다 앞에서 크고 또렷하게.
      const layout = beadLayoutAt(f.spin, i, N);
      const x = cx + layout.xOffset * W * f.orbitR;
      const y = cy + layout.yOffset * W * f.orbitR;
      const s = el.offsetWidth || 1;
      const scale = f.beadScale * layout.scale;
      el.style.transform = `translate(${x - s / 2}px, ${y - s / 2}px) scale(${scale})`;
      el.style.opacity = String(f.beadAlpha * layout.opacityMul);
      el.style.filter = layout.blurPx > 0.05 ? `blur(${layout.blurPx.toFixed(2)}px)` : '';
      // 뒤쪽 구슬은 hand-img/hand-after보다 아래로 — 손가락 사이 투명 영역으로 비쳐 보인다.
      el.style.zIndex = layout.front ? '3' : '0';
    });

    // 첫 사이클의 정지 구간에는 카드를 건드리지 않아 CSS 입장 애니메이션(hero-rise)이 그대로 재생되게 둔다.
    // 루프가 실제로 카드를 바꿔야 하는 시점(소용돌이 진입)부터만 소유권을 가져온다.
    if (!cardsOwnedByLoop.current && tMs >= MORPH.holdStart) {
      cardsOwnedByLoop.current = true;
    }
    if (cardsOwnedByLoop.current) {
      cardRefs.current.forEach((el) => {
        if (!el) return;
        // animation 단축 속성은 'none'을 넣어도 읽을 때 'none 0s ease 0s 1 normal none running'처럼
        // 풀어헤쳐 직렬화되므로 항상 다르게 보인다 — animationName만 비교해야 한 번만 쓴다.
        if (el.style.animationName !== 'none') el.style.animation = 'none';
        el.style.opacity = String(f.cardAlpha);
      });
    }

    const after = afterRef.current;
    if (after) {
      after.style.opacity = f.reveal > 0 ? '1' : '0';
      // 손톱 무리(상단 중앙)에서 원형으로 번짐 — 120%면 손 전체를 덮는다
      after.style.clipPath = `circle(${(f.reveal * 120).toFixed(2)}% at 50% ${NAIL_Y * 100}%)`;
    }
    if (flashRef.current) flashRef.current.style.opacity = String(f.flash);
  }, []);

  // rafRef가 0이면 "체인 없음"을 뜻한다 — loop() 재호출 전 항상 이 값으로 기존 체인을
  // 취소해 두 체인이 동시에 도는 일이 없게 한다.
  const loop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      applyFrame((now - t0.current) % MORPH_TOTAL);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [applyFrame]);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setReduced(true); return; }
    // 백그라운드 탭에서 로드되면 visibilitychange의 'hidden' 이벤트가 먼저 오지 않을 수 있다.
    // 그 경우 실제로 일시정지된 적이 없으므로, 보이는 상태가 될 때까지는 아예 체인을
    // 시작하지 않는다(started로 구분) — "일시정지에서 재개"와 "최초 시작"을 섞지 않는다.
    let started = false;
    let paused = false;
    const start = () => {
      started = true;
      t0.current = performance.now();
      loop();
    };
    if (!document.hidden) start();
    // 백그라운드 탭이면 일시정지 (배터리 배려)
    const onVis = () => {
      if (document.hidden) {
        if (started && !paused) {
          cancelAnimationFrame(rafRef.current);
          pausedAt.current = performance.now();
          paused = true;
        }
      } else if (!started) {
        start();
      } else if (paused) {
        t0.current += performance.now() - pausedAt.current;
        paused = false;
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
