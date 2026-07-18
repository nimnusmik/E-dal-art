'use client';

import { useEffect, useRef } from 'react';

/** 스크롤 진입 시 1회 `is-revealed` 클래스 토글 (IntersectionObserver) */
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

/**
 * 래퍼 요소의 뷰포트 통과 진행률(0~1)을 rAF + lerp(0.12)로 CSS 변수 `--sx`에 기록.
 * 데스크톱(768px+)이면서 모션 허용일 때만 활성 — 모바일/reduced-motion은 CSS 폴백.
 */
export function useStickyProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!matchMedia('(min-width: 768px)').matches) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let target = 0;
    let current = -1;
    let raf = 0;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const total = rect.height - innerHeight;
      target = total > 0 ? Math.min(1, Math.max(0, -rect.top / total)) : 0;
    };
    const tick = () => {
      current = current < 0 ? target : current + (target - current) * 0.12;
      if (Math.abs(target - current) < 0.0005) current = target;
      el.style.setProperty('--sx', String(current));
      raf = current !== target ? requestAnimationFrame(tick) : 0;
    };
    const onScroll = () => {
      measure();
      if (!raf) raf = requestAnimationFrame(tick);
    };

    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll);
    return () => {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return ref;
}
