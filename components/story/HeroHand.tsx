'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Masthead from '@/components/editorial/Masthead';
import { currentIssue } from '@/lib/issue';
import { HERO_INSPO } from './heroInspo';
import { frameAt, MORPH, MORPH_TOTAL, NAIL_Y } from './heroMorph';

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
  // 카드 입장 애니메이션(CSS, forwards)이 끝날 때까지는 카드에 손대지 않는다 — 첫 사이클 정지 구간 한정
  const cardsOwnedByLoop = useRef(false);
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

    // 첫 사이클의 정지 구간에는 카드를 건드리지 않아 CSS 입장 애니메이션(hero-rise)이 그대로 재생되게 둔다.
    // 루프가 실제로 카드를 바꿔야 하는 시점(소용돌이 진입)부터만 소유권을 가져온다.
    if (!cardsOwnedByLoop.current && tMs >= MORPH.holdStart) {
      cardsOwnedByLoop.current = true;
    }
    if (cardsOwnedByLoop.current) {
      cardRefs.current.forEach((el) => {
        if (!el) return;
        if (el.style.animation !== 'none') el.style.animation = 'none';
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
