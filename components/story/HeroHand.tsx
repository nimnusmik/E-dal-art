'use client';

import Masthead from '@/components/editorial/Masthead';
import { currentIssue } from '@/lib/issue';
import { HERO_INSPO } from './heroInspo';

/** 표지 — 발행호 + 세리프 헤드라인 + 맨손(제시하는 손) 무대에 영감 사진 4장이 라벨과 함께 뜬다. */
export default function HeroHand() {
  const issue = currentIssue();
  return (
    <section className="story-hero" aria-label="이달아 — 이달의 네일 아트">
      <Masthead />
      <div className="hero-body">
        <p className="overline" suppressHydrationWarning>{issue.label}</p>
        <h1 className="hero-title">
          이달의 네일을,
          <br />
          먼저 만나요
        </h1>
        <p className="hero-sub">영감 사진 한 장이면, 당신의 다음 시안이 나와요</p>
        <a className="btn-fill hero-cta" href="#tool">
          이번 호 시안 만들기
        </a>
        <div className="hand-stage" aria-label="영감 사진이 손 위에서 이달의 네일이 되는 장면">
          <img
            className="hand-img"
            src="/hero/hand.webp"
            alt=""
            width={320}
            height={400}
            loading="eager"
            decoding="async"
          />
          {HERO_INSPO.map((cut) => (
            <figure className={`inspo-cut at-${cut.at}`} key={cut.src}>
              <span className="inspo-line" aria-hidden />
              <img className="inspo-img" src={cut.src} alt={`영감 예시 — ${cut.label}`} loading="eager" decoding="async" />
              <figcaption className="inspo-cap">
                <span className="inspo-no">{cut.no}</span>
                {cut.label}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
      <div className="hero-cue" aria-hidden>
        Scroll
      </div>
    </section>
  );
}
