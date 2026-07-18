'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import Masthead from '@/components/editorial/Masthead';
import { currentIssue } from '@/lib/issue';

const RING_IMAGES = Array.from(
  { length: 10 },
  (_, i) => `/samples/ring-${String(i + 1).padStart(2, '0')}.webp`,
);

/** 표지 — 발행호 + 세리프 헤드라인 + 네일 팁 3D 링(앞 아치만, 70s 감상 속도) */
export default function HeroRing() {
  const stageRef = useRef<HTMLDivElement>(null);
  const issue = currentIssue();

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => el.classList.toggle('is-paused', !e.isIntersecting),
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
        <div className="ring-stage" ref={stageRef} aria-hidden>
          <div className="ring-tilt">
            <div className="ring">
              {RING_IMAGES.map((src, i) => (
                <div className="ring-item" style={{ '--i': i } as CSSProperties} key={src}>
                  <img src={src} alt="" width={136} height={340} loading="eager" decoding="async" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div className="hero-cue" aria-hidden>
        Scroll
      </div>
    </section>
  );
}
