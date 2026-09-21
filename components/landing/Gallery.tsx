'use client';

import type { CSSProperties } from 'react';
import { useEffect, useRef, useState } from 'react';
import type { GalleryCut } from './content';
import { GALLERY } from './content';
import { useReveal } from './useReveal';

/**
 * 초원 배경 위 폴라로이드 시안 카드.
 * 맥 트래픽 라이트 3점은 걷어냈다 — CSS 주석이 선언한 Windows XP 컨셉과
 * 정반대 OS 신호여서 두 레퍼런스가 서로를 지웠고, 네일 사진에 브라우저 크롬이
 * 붙을 이유도 없었다. 은유는 "인쇄된 사진" 하나로 정리한다.
 *
 * 확대 보기는 네이티브 <dialog> — 포커스 트랩·Esc·백드롭이 공짜다.
 * 시안 디테일(파츠·질감)이 이 제품의 상품성인데 320px 썸네일에서 끝나면
 * "이런 시안이 나와요"가 증명을 반만 하는 셈이었다.
 */
export default function Gallery() {
  const ref = useReveal<HTMLUListElement>(0.12);
  const [zoomed, setZoomed] = useState<GalleryCut | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (zoomed && !d.open) d.showModal();
    if (!zoomed && d.open) d.close();
  }, [zoomed]);

  return (
    <section className="xp-meadow xp-gallery" aria-label="시안 예시">
      <div className="xp-head xp-head-on-photo">
        <span className="xp-pill t-yellow" aria-hidden>Looks</span>
        <h2 className="xp-display">이런 시안이 나와요</h2>
        <p>실제로 만들어 검수를 통과한 시안이에요. 영감 사진은 섞지 않았어요.</p>
      </div>
      <ul className="xp-polaroids" role="list" ref={ref}>
        {GALLERY.map((g, i) => (
          <li
            className="xp-polaroid-slot xp-reveal"
            style={{ '--d': `${i * 110}ms` } as CSSProperties}
            key={g.src}
          >
            <button
              type="button"
              className="xp-polaroid-btn"
              aria-label={`크게 보기 — ${g.title}`}
              onClick={() => setZoomed(g)}
            >
              <figure
                className="xp-polaroid"
                style={{ '--tilt': `${g.tilt}deg` } as CSSProperties}
              >
                <img src={g.src} alt={`시안 예시 — ${g.title}`} width={320} height={320} loading="lazy" decoding="async" />
                <figcaption>
                  <strong>{g.title}</strong>
                  <span>{g.meta}</span>
                </figcaption>
              </figure>
            </button>
          </li>
        ))}
      </ul>
      <dialog
        className="xp-lightbox"
        ref={dialogRef}
        onClose={() => setZoomed(null)}
        /* 백드롭 클릭 = 닫기. 다이얼로그 안쪽 클릭은 target이 자식 요소라 걸러진다 */
        onClick={(e) => { if (e.target === dialogRef.current) setZoomed(null); }}
        aria-label={zoomed ? `시안 크게 보기 — ${zoomed.title}` : '시안 크게 보기'}
      >
        {zoomed && (
          <figure className="xp-lightbox-body">
            <img src={zoomed.src} alt={`시안 예시 — ${zoomed.title}`} />
            <figcaption>
              <strong>{zoomed.title}</strong>
              <span>{zoomed.meta}</span>
            </figcaption>
            <button type="button" className="xp-lightbox-close" onClick={() => setZoomed(null)}>
              닫기
            </button>
          </figure>
        )}
      </dialog>
    </section>
  );
}
