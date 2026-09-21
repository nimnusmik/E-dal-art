'use client';

import { useEffect, useRef, useState } from 'react';
import { useGate } from '@/lib/useGate';
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
  const gate = useGate();
  const gated = gate.inviteRequired && !gate.hasInvite;
  const wrapRef = useRef<HTMLDivElement>(null);
  const state = usePhoneState(wrapRef);

  return (
    <section className="xp-hero xp-meadow" id="top" aria-label="이달아 — 이달의 네일 아트">
      <div className="xp-hero-copy">
        <div className="xp-hero-pills" aria-hidden>
          <span className="xp-pill" suppressHydrationWarning>
            {issue.monthLabel}
          </span>
          <span className="xp-pill">
            {gated ? '초대받은 분만 · 예시는 자유롭게' : '가입 없이 · 하루 3회 무료'}
          </span>
        </div>
        {/* 디스플레이 레이어는 영어, 설득 문장은 한국어 — 이중 레이어 카피 체계 */}
        <h1 className="xp-display xp-hero-title">
          One photo becomes
          <br />
          this month&apos;s nails
        </h1>
        <p className="xp-hero-sub">
          영감 사진을 올리면 AI가 다섯 갈래 시안을 만들어요. 마음에 든 시안은 손에 올린 모습까지
          미리 볼 수 있어요.
        </p>
        <a className="xp-cta" href="#tool">
          {gated ? '초대 코드로 시작하기' : '무료로 시안 만들기'}
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
        aria-label="휴대폰에 영감 사진을 올리면 AI가 변주해 이달의 네일 시안이 완성되는 과정. 뒤에는 이달의 시안 무드 네 종이 놓여 있다"
      >
        <div className="hero-stage-sticky">
          <ul className="hero-panels" aria-hidden>
            <li className="hero-panel hero-panel-input">
              <span className="hero-panel-label">Inspiration</span>
              <div className="hero-panel-stack">
                {HERO_INSPO.slice(0, 3).map((cut) => (
                  <img key={cut.src} src={cut.src} alt="" width={96} height={96} loading="eager" decoding="async" />
                ))}
              </div>
              <span className="hero-panel-meta">스크린샷·옷·하늘, 1–3장</span>
              <a className="hero-panel-plus" href="#tool" tabIndex={-1} aria-hidden>
                <span>+</span>
              </a>
            </li>
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
                <img
                  className="phone-drop-img"
                  src="/hero/insp/dreamy.webp"
                  alt=""
                  width={200}
                  height={200}
                  loading="eager"
                  decoding="async"
                />
                <span className="phone-drop-hint">Drop your inspo photo</span>
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
