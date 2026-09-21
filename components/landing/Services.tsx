'use client';

import { useEffect, useRef, useState } from 'react';
import { SERVICES } from './content';
import { markReady } from './useReveal';

/**
 * 이용 흐름 5행 — 핀 고정 스크롤 스토리.
 * 섹션이 화면에 고정된 채(sticky), 스크롤 진행도에 따라 행이 한 칸씩 내려온다.
 * 히어로 폰(usePhoneState)과 같은 패턴: wrap 높이에서 100dvh를 뺀 구간이 진행도.
 *
 * 폴백 원칙은 리빌과 동일 — 숨김은 .js-reveal-ready 이후에만 적용되므로
 * no-JS·인쇄에서는 5행이 처음부터 다 보인다. 모션 저감은 전부 표시로 고정.
 */
function useScrollStep(wrapRef: React.RefObject<HTMLDivElement | null>, count: number): number {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!markReady()) return; // 숨기지도 않았으니 진행도 계산도 불필요
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(count - 1);
      return;
    }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = wrapRef.current;
        if (!el) return;
        const scrollable = el.offsetHeight - window.innerHeight;
        if (scrollable <= 0) {
          setStep(count - 1);
          return;
        }
        const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / scrollable));
        setStep(Math.min(count - 1, Math.floor(p * count)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [wrapRef, count]);
  return step;
}

export default function Services() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const step = useScrollStep(wrapRef, SERVICES.length);

  return (
    <section className="xp-paper xp-services" aria-label="이용 흐름">
      <div className="svc-scroll-wrap" ref={wrapRef}>
        <div className="svc-sticky">
          <div className="xp-head">
            <span className="xp-pill t-purple" aria-hidden>Process</span>
            <h2>
              Five steps,
              <br />
              one monthly set
            </h2>
          </div>
          {/* list-style:none이 붙은 ul은 Safari/VoiceOver에서 리스트 의미를 잃는다 */}
          <ul className="xp-service-list" role="list">
            {SERVICES.map((s, i) => (
              <li
                className={`xp-service-row s${i + 1}${i <= step ? ' is-shown' : ''}`}
                key={s.no}
              >
                <span className="xp-service-no">{s.no}</span>
                <span className="xp-service-label">{s.label}</span>
                <p className="xp-service-body">{s.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
