'use client';

import { useRef, useState } from 'react';
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
 *
 * 2026-11-01 (YouCam 해커톤, 시안 H4 = remove.bg식 업로드 + 단계 칩 + YouCam 라벨):
 * 버튼 대신 업로드 칸과 예시 사진을 히어로에 — 성공한 AI 제품처럼 첫 화면에서 바로 시작.
 * 사진은 'idala:add-photos' 이벤트로 작업 카드(app/page.tsx)에 넘기고 카드로 스크롤한다.
 * 로그인 전에는 파일 창을 열지 않고 카드(구글 로그인)로 보낸다 — 로그인 새로고침에 사진이 날아간다.
 */

export const SAMPLE_PHOTOS = ['/hero/insp/wings.webp', '/hero/insp/fairycore.webp', '/hero/insp/dreamy.webp'];

/** 작업 카드로 내려가며 테두리를 빛나게 — '여기서 이어서 하면 된다' */
export function goToTool() {
  const tool = document.getElementById('tool');
  tool?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const card = tool?.querySelector('.xp-tool-card');
  if (!card) return;
  card.classList.remove('is-glow');
  void (card as HTMLElement).offsetWidth; // 애니메이션 재시작
  card.classList.add('is-glow');
}

function handOff(files: File[]) {
  window.dispatchEvent(new CustomEvent<File[]>('idala:add-photos', { detail: files }));
  goToTool();
}

export async function sampleFiles(): Promise<File[]> {
  return Promise.all(
    SAMPLE_PHOTOS.map(async (src) => {
      const blob = await (await fetch(src)).blob();
      return new File([blob], src.split('/').pop()!, { type: blob.type });
    }),
  );
}

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
  const [dropping, setDropping] = useState(false);
  const takeFiles = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith('image/'));
    if (files.length) handOff(files);
  };

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
        <span className="hs-chip"><span className="hs-dot" aria-hidden />{access.email ? 'Up to 3 photos in · 3 nail sets out' : `${FREE_CREDITS} free runs · no card needed`}</span>
        <h1 className="hs-title">
          Turn your photos into nails, <em>on your own hand</em>
        </h1>
        <ol className="hs-steps" aria-label="How it works">
          <li><i>1</i>Your photos</li>
          <li><i>2</i>3 nail sets</li>
          <li><i>3</i>On your hand</li>
        </ol>
        {access.paid ? (
          <label
            className={`hs-drop${dropping ? ' is-dropping' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDropping(true); }}
            onDragLeave={() => setDropping(false)}
            onDrop={(e) => { e.preventDefault(); setDropping(false); takeFiles(e.dataTransfer?.files); }}
          >
            <span className="hs-drop-plus" aria-hidden>+</span>
            <span><b>Drop a photo you love</b><small>Click, drag or paste · Pinterest saves work great</small></span>
            <input type="file" accept="image/*" multiple className="visually-hidden" onChange={(e) => { takeFiles(e.target.files); e.target.value = ''; }} />
          </label>
        ) : (
          // 로그인 전: 파일 창 대신 작업 카드(구글 로그인)로 — 로그인 새로고침에 사진이 날아간다
          <a className="hs-drop" href="#tool" onClick={(e) => { e.preventDefault(); goToTool(); }}>
            <span className="hs-drop-plus" aria-hidden>+</span>
            <span><b>Drop a photo you love</b><small>Sign in with Google for {FREE_CREDITS} free runs</small></span>
          </a>
        )}
        <div className="hs-samples">
          <span>or try one:</span>
          {SAMPLE_PHOTOS.map((src) => (
            <button
              key={src}
              aria-label="Use sample photos"
              onClick={async () => (access.paid ? handOff(await sampleFiles()) : goToTool())}
            >
              <img src={src} alt="" />
            </button>
          ))}
        </div>
        <p className="hs-trust">
          Try-on by <b>YouCam AI</b> · Designs by Meta Muse · Then ₩{PRICE_REGULAR_KRW.toLocaleString('ko-KR')} for {PACK_CREDITS} runs
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
          {/* 맨손이 다 바뀐 순간에만 떠오름 — 손 쓸기(hs-paint)와 같은 7초 주기 */}
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
