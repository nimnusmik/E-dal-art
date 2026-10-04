'use client';

import { useEffect, useRef, useState } from 'react';
import { useAccess } from '@/lib/useAccess';
import { useIssue } from '@/lib/useIssue';
import { GALLERY } from '@/components/landing/content';
import { HERO_INSPO } from './heroInspo';

/**
 * 라이트 히어로 — 레퍼런스(see-for-yourself.com) 구성:
 * 초대형 검정 타이포 → 패널 행(완성본 시안 무드) 가운데 폰이 떠 있고,
 * 스크롤을 내리면 폰 화면이 진화한다:
 *   0 빈 드롭존("영감 사진을 올려보세요") → 1 사진 투입 + AI 변주 중 → 2 시안 완성 ✓
 * 폰 = 입력, 뒤 패널 = 출력 — 제품 서사를 스크롤 한 번으로 겪게 한다.
 */

/** 스크롤 진행도 → 폰 상태. 모션 저감 사용자는 완성 상태(2) 고정 */
function usePhoneState(wrapRef: React.RefObject<HTMLDivElement | null>): 0 | 1 | 2 {
  const [state, setState] = useState<0 | 1 | 2>(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setState(2);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const wrap = wrapRef.current;
        if (!wrap) return;
        const rect = wrap.getBoundingClientRect();
        const scrollable = wrap.offsetHeight - window.innerHeight;
        if (scrollable <= 0) return;
        const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
        setState(progress < 0.3 ? 0 : progress < 0.62 ? 1 : 2);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [wrapRef]);
  return state;
}

export default function Hero() {
  const issue = useIssue();
  const access = useAccess();
  // 얼리버드(선착순 100명 ₩4,900)가 살아 있으면 CTA에 그 가격을, 아니면 정가를.
  // 쿠폰 상태를 모르면(null) 얼리버드를 약속하지 않는다.
  const earlyBird = access.earlyBirdLeft !== null && access.earlyBirdLeft > 0;
  const wrapRef = useRef<HTMLDivElement>(null);
  const state = usePhoneState(wrapRef);

  return (
    <section className="xp-hero xp-meadow" id="top" aria-label="idala — nail sets of the month">
      <div className="xp-hero-copy">
        <div className="xp-hero-pills" aria-hidden>
          <span className="xp-pill" suppressHydrationWarning>
            {issue.monthLabel}
          </span>
          <span className="xp-pill">
            {access.paid
              ? `${access.remaining ?? 0} runs left`
              : earlyBird
                ? 'Early bird · first 100 only'
                : '10 runs · no subscription'}
          </span>
        </div>
        {/* 디스플레이 레이어는 영어, 설득 문장은 한국어 — 이중 레이어 카피 체계 */}
        <h1 className="xp-display xp-hero-title">
          One photo becomes
          <br />
          this month&apos;s nails
        </h1>
        <p className="xp-hero-sub">
          Upload an inspiration photo and AI styles five nail sets. Preview your favorite on a hand before you commit.
        </p>
        {/* 무료가 아니다 — "free"라고 쓰면 결제 페이지에서 배신당한다.
            이용권이 있으면 만들기, 없으면 가격을 정직하게. */}
        <a className="xp-cta" href="#tool">
          {access.paid
            ? 'Create my set'
            : earlyBird
              ? 'Start — early bird ₩4,900'
              : 'Start — 10 runs ₩9,900'}
        </a>
        <span className="xp-hero-scrollhint" aria-hidden>
          Scroll to create ↓
        </span>
      </div>

      {/* 스크롤 스토리 구간 — 스테이지가 고정된 채 폰 화면이 3단계로 진화한다 */}
      <div
        className="hero-scroll-wrap"
        ref={wrapRef}
        role="img"
        aria-label="Inspiration photos drop into a phone, AI styles them, and the monthly nail set is ready — four finished mood sets stand behind"
      >
        <div className="hero-stage-sticky">
          {/* 패널은 전부 완성본(검수 통과 시안) — 입력은 폰이 전담한다 */}
          <ul className="hero-panels" aria-hidden>
            {GALLERY.map((g) => (
              <li className="hero-panel" key={g.src}>
                <span className="hero-panel-label">{g.title}</span>
                <img
                  className="hero-panel-img"
                  src={g.src}
                  alt=""
                  width={320}
                  height={320}
                  loading="eager"
                  decoding="async"
                />
                <span className="hero-panel-meta">{g.meta}</span>
                <a className="hero-panel-plus" href="#tool" tabIndex={-1} aria-hidden>
                  <span>+</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="hero-phone" data-state={state} aria-hidden>
            <span className="hero-phone-island" />
            <div className="hero-phone-screen">
              <div className="phone-drop">
                {/* 영감 사진 3장이 부채꼴로 스며든다 — 제품 상한(최대 3장)과 일치 */}
                <div className="phone-drop-stack">
                  {HERO_INSPO.slice(0, 3).map((cut) => (
                    <img
                      key={cut.src}
                      src={cut.src}
                      alt=""
                      width={140}
                      height={140}
                      loading="eager"
                      decoding="async"
                    />
                  ))}
                </div>
                <span className="phone-drop-hint">Drop your inspo photos</span>
                <span className="phone-drop-check">✓</span>
              </div>
              <div className="phone-status">
                <span className="phone-status-line" data-for="0">One photo is enough</span>
                <span className="phone-status-line" data-for="1">Styling 5 variants…</span>
                <span className="phone-status-line" data-for="2">Your set is ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
