'use client';

import { useEffect, useRef, useState } from 'react';
import type { Look } from './looks-data';

/**
 * 메인 월(월별 챕터) + Sketchbook(실험 기록) + 공용 확대 보기.
 * 메인은 featured 2×2 위계, 스케치북은 작은 등폭 타일 — 간판과 과정의 체급을
 * 레이아웃으로 구분한다. 확대는 네이티브 <dialog> 하나를 둘이 공유한다.
 */
function Card({ look, onZoom, eager }: { look: Look; onZoom: (l: Look) => void; eager?: boolean }) {
  return (
    <button
      type="button"
      className="lk-card"
      aria-label={`View larger: ${look.title}`}
      onClick={() => onZoom(look)}
    >
      <img
        src={look.src}
        alt={`${look.title}, ${look.meta}`}
        width={600}
        height={600}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
      />
      <span className="lk-card-caption">
        <strong>{look.title}</strong>
        <span>{look.meta}</span>
        <em>{look.issue}</em>
      </span>
    </button>
  );
}

export default function LooksGrid({
  chapters,
  sketches,
}: {
  chapters: { issue: string; looks: Look[] }[];
  sketches: Look[];
}) {
  const [zoomed, setZoomed] = useState<Look | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (zoomed && !d.open) d.showModal();
    if (!zoomed && d.open) d.close();
  }, [zoomed]);

  return (
    <>
      <div id="lk-grid">
        {chapters.map((ch, ci) => (
          <section className="lk-chapter" key={ch.issue} aria-label={ch.issue}>
            <h2 className="lk-chapter-head">
              <span className="lk-chapter-issue">{ch.issue}</span>
              <span className="lk-chapter-rule" aria-hidden />
            </h2>
            <ul className="lk-grid" role="list">
              {ch.looks.map((look) => (
                <li className={`lk-cell${look.featured ? ' is-featured' : ''}`} key={look.src}>
                  <Card look={look} onZoom={setZoomed} eager={ci === 0} />
                </li>
              ))}
            </ul>
          </section>
        ))}

        {sketches.length > 0 && (
          <section className="lk-sketchbook" aria-label="Sketchbook">
            <h2 className="lk-chapter-head">
              <span className="lk-chapter-issue">Sketchbook</span>
              <span className="lk-chapter-rule" aria-hidden />
            </h2>
            {/* 간판이 아니라 과정이다 — 과장 없이 실험 기록으로 표기한다 */}
            <p className="lk-sketch-note">
              Experiments, drafts and practice boards behind the wall. Unfiltered, imperfections included.
            </p>
            <ul className="lk-grid lk-grid-sketch" role="list">
              {sketches.map((look) => (
                <li className="lk-cell" key={look.src}>
                  <Card look={look} onZoom={setZoomed} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="xp-lightbox lk-lightbox"
        aria-label={zoomed ? `${zoomed.title} enlarged` : undefined}
        onClose={() => setZoomed(null)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setZoomed(null); // 백드롭 클릭 닫기
        }}
      >
        {zoomed && (
          <figure className="xp-lightbox-body">
            <img src={zoomed.src} alt={`${zoomed.title}, ${zoomed.meta}`} width={1200} height={1200} />
            <figcaption>
              <strong>{zoomed.title}</strong>
              <span>
                {zoomed.meta} · {zoomed.issue}
              </span>
            </figcaption>
            <button type="button" className="xp-lightbox-close" onClick={() => setZoomed(null)}>
              Close
            </button>
          </figure>
        )}
      </dialog>
    </>
  );
}
