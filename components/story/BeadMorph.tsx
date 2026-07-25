'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HERO_INSPO } from './heroInspo';

const AFTER_SRC = '/hero/ba-after.webp';
const DURATION = 3600; // 전체 변신 길이(ms)

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * 영감 사진 각각이 광택 구슬 1개가 되어 중앙으로 모여 소용돌이(섞임) →
 * 하나로 합쳐진 뒤 → 번쩍하며 완성 시안이 "짠" 하고 등장.
 * 섹션 진입 시 1회 자동 재생 + 다시보기. reduced-motion은 결과 정지 이미지.
 */
export default function BeadMorph() {
  const stageRef = useRef<HTMLDivElement>(null);
  const beadRefs = useRef<(HTMLDivElement | null)[]>([]);
  const resultRef = useRef<HTMLImageElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const startRef = useRef(0);
  const playedRef = useRef(false);
  const [reduced, setReduced] = useState(false);

  const beads = HERO_INSPO; // 영감 4장 = 구슬 4개
  const N = beads.length;

  const frame = useCallback((p: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const W = stage.clientWidth, H = stage.clientHeight;
    const cx = W / 2, cy = H / 2;

    // 누적 회전(섞임) — 합쳐지기 전까지 가속
    const spin = easeInOut(clamp01(p / 0.72)) * Math.PI * 2.4;

    // 페이즈별 궤도 반경 / 구슬 스케일 / 알파
    let R: number, beadScale: number, beadAlpha: number;
    if (p < 0.24) {
      // 등장 + 모여듦(whoosh in)
      const t = easeOut(p / 0.24);
      R = lerp(W * 0.46, W * 0.27, t);
      beadScale = lerp(0.5, 1, t);
      beadAlpha = clamp01(t * 1.6);
    } else if (p < 0.62) {
      // 소용돌이 섞임
      R = W * 0.27;
      beadScale = 1;
      beadAlpha = 1;
    } else if (p < 0.78) {
      // 하나로 합쳐짐
      const t = easeInOut((p - 0.62) / 0.16);
      R = lerp(W * 0.27, 0, t);
      beadScale = lerp(1, 0.24, t);
      beadAlpha = 1;
    } else {
      // 사라지며 결과에 자리 내줌
      R = 0;
      beadScale = 0.24;
      beadAlpha = Math.max(0, 1 - (p - 0.78) / 0.06);
    }

    beadRefs.current.forEach((el, i) => {
      if (!el) return;
      const ang = (i / N) * Math.PI * 2 + spin;
      // 반경에 구슬별 위상 흔들림 — 기계적 등속 원운동 탈피
      const wob = 1 + 0.06 * Math.sin(spin * 2 + i * 1.7);
      const x = cx + Math.cos(ang) * R * wob;
      const y = cy + Math.sin(ang) * R * wob * 0.72; // 살짝 타원 궤도
      const s = el.offsetWidth || 1;
      el.style.transform = `translate(${x - s / 2}px, ${y - s / 2}px) scale(${beadScale})`;
      el.style.opacity = String(beadAlpha);
    });

    // 결과 — 구슬이 모인 중심에서 원형으로 번져 나옴 (서클 리빌)
    const res = resultRef.current;
    if (res) {
      if (p < 0.68) {
        res.style.opacity = '0';
        res.style.clipPath = 'circle(0% at 50% 50%)';
      } else {
        const t = easeInOut(clamp01((p - 0.68) / 0.3));
        res.style.opacity = String(clamp01(t * 2.2));
        res.style.clipPath = `circle(${(t * 78).toFixed(2)}% at 50% 50%)`;
      }
      res.style.transform = 'none';
    }

    // 합쳐지는 순간 은은한 광
    const fl = flashRef.current;
    if (fl) fl.style.opacity = p >= 0.66 && p < 0.86 ? String(Math.max(0, 0.5 - Math.abs(p - 0.74) / 0.16)) : '0';
  }, [N]);

  const play = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    startRef.current = performance.now();
    const tick = () => {
      const p = clamp01((performance.now() - startRef.current) / DURATION);
      frame(p);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [frame]);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setReduced(true); return; }
    frame(0);
    const stage = stageRef.current;
    if (!stage) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !playedRef.current) {
          playedRef.current = true;
          play();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(stage);
    return () => { io.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [frame, play]);

  return (
    <section className="story-morph" aria-label="영감에서 시안으로">
      <span className="section-ghost" aria-hidden>02</span>
      <div className="section-head">
        <div className="section-meta">
          <span className="section-no">No.02</span>
          <span className="overline">Before &amp; After</span>
        </div>
        <h2 className="section-title">영감 한 장이, 시안이 되기까지</h2>
      </div>
      <div className="morph-stage" ref={stageRef}>
        {reduced ? (
          <img className="morph-result morph-static" src={AFTER_SRC} alt="영감으로 만든 네일 시안" />
        ) : (
          <>
            {beads.map((b, i) => (
              <div
                className="morph-bead"
                key={b.src}
                aria-hidden
                ref={(el) => { beadRefs.current[i] = el; }}
              >
                <img src={b.src} alt="" draggable={false} />
              </div>
            ))}
            <div className="morph-flash" ref={flashRef} aria-hidden />
            <img className="morph-result" ref={resultRef} src={AFTER_SRC} alt="영감으로 만든 네일 시안" draggable={false} />
          </>
        )}
      </div>
      {!reduced && (
        <button className="morph-replay" type="button" onClick={play} aria-label="변신 다시 보기">
          ↻ 다시 보기
        </button>
      )}
    </section>
  );
}
