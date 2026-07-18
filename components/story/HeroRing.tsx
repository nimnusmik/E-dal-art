'use client';

import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';

const RING_IMAGES = Array.from(
  { length: 10 },
  (_, i) => `/samples/ring-${String(i + 1).padStart(2, '0')}.webp`,
);

/** 네일 팁 10장이 3D 링으로 자동 회전하는 히어로. 오프스크린 시 IO로 pause. */
export default function HeroRing() {
  const stageRef = useRef<HTMLDivElement>(null);

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
      <div className="ring-stage" ref={stageRef} aria-hidden>
        <div className="ring-tilt">
          <div className="ring">
            {RING_IMAGES.map((src, i) => (
              <div
                className="ring-item"
                style={{ '--i': i } as CSSProperties}
                key={src}
              >
                <img src={src} alt="" width={136} height={340} loading="eager" decoding="async" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="hero-copy">
        <h1 className="hero-title brand-chrome">이달아</h1>
        <p className="hero-tagline">이달의 네일, 사진 한 장이면 미리 만나요</p>
        <p className="hero-sub">영감 사진 1~3장 → AI 네일 아트 시안</p>
      </div>
      <div className="hero-scroll-cue" aria-hidden>
        SCROLL ▼
      </div>
    </section>
  );
}
