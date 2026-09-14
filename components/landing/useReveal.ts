'use client';

import { useEffect, useRef } from 'react';

/**
 * 리빌의 기본값은 "보임"이다. `.js-reveal-ready`가 <html>에 붙은 뒤에만 CSS가
 * .xp-reveal을 숨긴다 — 즉 JS 실패·IntersectionObserver 미지원·인쇄·스크롤 없는
 * 캡처에서는 콘텐츠가 그대로 보인다. 애니메이션이 콘텐츠 가시성의 전제조건이 되면
 * 실패 방향이 "빈 페이지"가 되므로 방향을 뒤집는다.
 */
function markReady(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof IntersectionObserver === 'undefined') return false;
  document.documentElement.classList.add('js-reveal-ready');
  return true;
}

/** 스크롤 진입 시 1회 `is-revealed`를 붙여 자식 .xp-reveal을 순차 노출시킨다 */
export function useReveal<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!markReady()) return; // IO를 못 쓰면 숨기지도 않는다 — 콘텐츠는 이미 보인다
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
    // 이미 뷰포트 안이면(앵커 점프·해시 진입) 관측 콜백을 기다리지 않고 즉시 노출
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      el.classList.add('is-revealed');
      io.unobserve(el);
    }
    return () => io.disconnect();
  }, [threshold]);
  return ref;
}
