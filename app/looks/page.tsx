import type { Metadata } from 'next';
import { LOOKS } from './looks-data';
import LooksGrid from './LooksGrid';
import './looks.css';

/**
 * /looks — 생성물 아카이브(큐레이션) 페이지.
 * 랜딩이 "이번 달 4점"이라면 여기는 "여태 만든 전부 중 걸 만한 것".
 * 다크 에디토리얼 지면 — 푸터 CTA(#020109)와 같은 다크 레이어의 확장이라
 * 랜딩과 한 브랜드로 읽힌다. 큐레이션은 looks-data.ts 한 파일로만 늘고 준다.
 */
export const metadata: Metadata = {
  title: 'The Archive · idala',
  description: 'Every nail set born from an inspiration photo — the idala generation archive.',
};

export default function LooksPage() {
  return (
    <div className="lk-page">
      <a className="skip-link" href="#lk-grid">
        Skip to content
      </a>
      <header className="lk-top">
        <a className="lk-back" href="/">
          idala<span aria-hidden>✳</span>
        </a>
        <a className="xp-pill lk-top-cta" href="/#tool">
          Make yours
        </a>
      </header>
      <main>
        <section className="lk-hero">
          <p className="lk-overline">The Archive</p>
          <h1 className="xp-display lk-title">
            Every set,
            <br />
            born from a photo
          </h1>
          <p className="lk-sub">
            {LOOKS.length} sets generated from inspiration photos — curated, quality-checked, nothing staged.
          </p>
        </section>
        <LooksGrid looks={LOOKS} />
        <section className="lk-cta" aria-label="Make your own set">
          <h2 className="xp-display lk-cta-title">Your photo is next</h2>
          <a className="xp-cta lk-cta-btn" href="/#tool">
            Create my set
          </a>
        </section>
      </main>
      <footer className="lk-footer">
        <a href="/">← Back to idala</a>
      </footer>
    </div>
  );
}
