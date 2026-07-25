'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * 영감→시안 비포/애프터 드래그 슬라이더.
 * 아래 레이어 = 영감(before), 위 레이어 = 시안(after)을 clip-path로 핸들 오른쪽만 노출.
 * 핸들을 왼쪽으로 끌수록 시안이 더 드러난다. 포인터(마우스·터치)와 방향키 지원.
 */
export default function BeforeAfter() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(50); // 핸들 위치(%) — 0=전부 시안, 100=전부 영감

  const setFromClientX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const p = ((clientX - r.left) / r.width) * 100;
    setPos(Math.max(0, Math.min(100, p)));
  }, []);

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging.current) setFromClientX(e.clientX);
  };
  const stop = () => {
    dragging.current = false;
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 4));
    if (e.key === 'ArrowRight') setPos((p) => Math.min(100, p + 4));
  };

  return (
    <section className="story-ba" aria-label="영감에서 시안으로">
      <div className="section-head">
        <p className="overline">Before &amp; After</p>
        <h2 className="section-title">영감 한 장이, 시안이 되기까지</h2>
      </div>
      <div
        className="ba-slider"
        ref={wrapRef}
        role="slider"
        tabIndex={0}
        aria-label="영감과 시안 비교 슬라이더 (좌우로 드래그)"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(100 - pos)}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={stop}
        onPointerCancel={stop}
        onKeyDown={onKey}
      >
        <img className="ba-img" src="/hero/ba-before.webp" alt="영감 사진 — 몽환 파스텔" draggable={false} />
        <img
          className="ba-img ba-top"
          src="/hero/ba-after.webp"
          alt="이 영감으로 만든 네일 시안"
          draggable={false}
          style={{ clipPath: `inset(0 0 0 ${pos}%)` }}
        />
        <span className="ba-label ba-label-before" aria-hidden>영감</span>
        <span className="ba-label ba-label-after" aria-hidden>시안</span>
        <span className="ba-divider" style={{ left: `${pos}%` }} aria-hidden>
          <span className="ba-handle">◀ ▶</span>
        </span>
      </div>
      <p className="ba-hint" aria-hidden>드래그해서 비교해보세요</p>
    </section>
  );
}
