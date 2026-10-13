'use client';

import { useEffect, useRef, useState } from 'react';
import type { Look } from './looks-data';

/**
 * 아카이브 그리드 + 확대 보기.
 * featured 항목은 2×2로 크게 — 균일 격자는 "목록"이고, 크기 위계가 있어야
 * "큐레이션"으로 읽힌다 (시안 자체의 주인공 위계와 같은 원칙).
 * 확대는 랜딩 갤러리와 같은 네이티브 <dialog> — 포커스 트랩·Esc가 공짜다.
 */
export default function LooksGrid({ looks }: { looks: Look[] }) {
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
      <ul className="lk-grid" id="lk-grid" role="list">
        {looks.map((look, i) => (
          <li className={`lk-cell${look.featured ? ' is-featured' : ''}`} key={look.src}>
            <button
              type="button"
              className="lk-card"
              aria-label={`View larger — ${look.title}`}
              onClick={() => setZoomed(look)}
            >
              <img
                src={look.src}
                alt={`${look.title} — ${look.meta}`}
                width={600}
                height={600}
                loading={i < 4 ? 'eager' : 'lazy'}
                decoding="async"
              />
              <span className="lk-card-caption">
                <strong>{look.title}</strong>
                <span>{look.meta}</span>
                <em>{look.issue}</em>
              </span>
            </button>
          </li>
        ))}
      </ul>

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
            <img src={zoomed.src} alt={`${zoomed.title} — ${zoomed.meta}`} width={1200} height={1200} />
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
