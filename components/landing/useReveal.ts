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
