'use client';

import { useRef } from 'react';
import type { CSSProperties } from 'react';
import { useAccess } from '@/lib/useAccess';
import { FREE_CREDITS, PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

/**
 * 히어로 (2026-10-27 개편) — 사진 상자 없이 떠 있는 장면.
 * 뒤: 영감 사진 3장(폴라로이드) · 가운데: 누끼 손이 맨손 ↔ 칠한 손으로 저절로 바뀜 · 앞: 낱개 팁이 떠다님.
 * 마우스를 움직이면 겹마다 다른 깊이(--z)로 따라온다.
 *
 * 이미지: public/hero/cutout — 팁은 시안 사진에서 SAM 3.1("fingernail")로 낱개 추출,
 * 손은 흰 배경 색 기준 누끼(SAM "hand"는 실행마다 손톱 포함 여부가 달라 손끝이 잘렸다).
 */

const TIPS: Array<{ n: number; style: CSSProperties; far?: boolean; top?: boolean; z: number }> = [
  { n: 1, z: 14, style: { left: '10%', top: '52%', width: 62, ['--r' as string]: '-24deg', ['--d' as string]: '4.6s' } },
  { n: 2, z: 14, top: true, style: { left: '20%', top: '30%', width: 48, ['--r' as string]: '18deg', ['--d' as string]: '5.4s' } },
  { n: 3, z: 14, style: { right: '14%', top: '36%', width: 58, ['--r' as string]: '28deg', ['--d' as string]: '4.2s' } },
  { n: 5, z: 14, style: { right: '20%', top: '70%', width: 50, ['--r' as string]: '-14deg', ['--d' as string]: '5.8s' } },
  { n: 4, z: 24, far: true, style: { left: '4%', top: '76%', width: 40, ['--r' as string]: '40deg', ['--d' as string]: '6.2s' } },
  { n: 6, z: 24, far: true, style: { right: '6%', top: '24%', width: 36, ['--r' as string]: '-30deg', ['--d' as string]: '5s' } },
  { n: 7, z: 24, top: true, style: { left: '30%', top: '10%', width: 44, ['--r' as string]: '-8deg', ['--d' as string]: '4.8s' } },
];

const POLAROIDS = [
  { src: '/hero/insp/wings.webp', label: 'photo 1', style: { left: '6%', top: '16%', transform: 'rotate(-9deg)' } },
  { src: '/hero/insp/fairycore.webp', label: 'photo 2', style: { right: '4%', top: '12%', transform: 'rotate(7deg)' } },
  { src: '/hero/insp/dreamy.webp', label: 'photo 3', style: { right: '2%', top: '52%', transform: 'rotate(-5deg)', width: 130 } },
];

export default function HeroScene() {
  const access = useAccess();
  const sceneRef = useRef<HTMLDivElement>(null);
  // 비로그인 = 가입하면 무료. 로그인했는데 0회일 때만 구매 문구
  const cta = access.paid ? 'Create my set' : access.email ? 'Get the pass' : `Try ${FREE_CREDITS} runs free`;

  const onMove = (e: React.MouseEvent) => {
    const el = sceneRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
    el.style.setProperty('--my', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
  };
  const onLeave = () => {
    sceneRef.current?.style.setProperty('--mx', '0');
    sceneRef.current?.style.setProperty('--my', '0');
  };

  return (
    <section className="hs" id="top" aria-label="idala: nail sets from your photos" onMouseMove={onMove} onMouseLeave={onLeave} ref={sceneRef}>
      <div className="hs-copy">
        <span className="hs-chip"><span className="hs-dot" aria-hidden />Up to 3 photos in · 3 nail sets out</span>
        <h1 className="hs-title">
          Turn your photos into nails, <em>on your own hand</em>
        </h1>
        <p className="hs-sub">
          Drop up to three photos you love. idala blends them into three nail sets, then paints your favorite onto a
          photo of your hand. Only the nails change.
        </p>
        <a className="hs-cta" href="#tool">
          {cta}
          {!access.email && <small>no card needed</small>}
        </a>
        <p className="hs-trust">
          Powered by Meta Muse and SAM 3.1 · Then ₩{PRICE_REGULAR_KRW.toLocaleString('ko-KR')} for {PACK_CREDITS} runs
        </p>
      </div>

      <div
        className="hs-scene"
        role="img"
        aria-label="A hand turns from bare nails to a pastel nail set, with loose nail tips floating around it and three inspiration photos pinned behind"
      >
        <div className="hs-layer" style={{ ['--z' as string]: -6 }}>
          {POLAROIDS.map((p) => (
            <figure className="hs-polaroid" key={p.src} style={p.style}>
              <img src={p.src} alt="" loading="eager" decoding="async" />
              <figcaption>{p.label}</figcaption>
            </figure>
          ))}
        </div>
        <div className="hs-layer" style={{ ['--z' as string]: 4 }}>
          <div className="hs-hand">
            <img src="/hero/cutout/hand-before.webp" alt="" loading="eager" decoding="async" />
            <img className="hs-after" src="/hero/cutout/hand-after.webp" alt="" loading="eager" decoding="async" />
          </div>
        </div>
        {[14, 24].map((z) => (
          <div className="hs-layer" style={{ ['--z' as string]: z }} key={z}>
            {TIPS.filter((t) => t.z === z).map((t) => (
              <span className={`hs-tip${t.far ? ' is-far' : ''}${t.top ? ' is-top' : ''}`} style={t.style} key={t.n}>
                <img src={`/hero/cutout/tip-${t.n}.webp`} alt="" loading="eager" decoding="async" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
