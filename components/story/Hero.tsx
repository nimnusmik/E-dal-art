'use client';

import { useGate } from '@/lib/useGate';
import { useIssue } from '@/lib/useIssue';
import { GALLERY } from '@/components/landing/content';
import { HERO_INSPO } from './heroInspo';

/**
 * 라이트 히어로 — 레퍼런스(see-for-yourself.com)의 구성 번역:
 * 초대형 검정 타이포 + 뷰포트를 채우는 카테고리 패널 행.
 * 패널 = 이달의 시안 무드들(실제 검수 통과작) + 맨 앞의 입력(영감 사진) 패널.
 * 각 패널의 ⊕는 툴로 앵커 — "이 무드로 만들러 가기"라는 하나의 행동으로 수렴한다.
 */
export default function Hero() {
  const issue = useIssue();
  const gate = useGate();
  const gated = gate.inviteRequired && !gate.hasInvite;

  return (
    <section className="xp-hero xp-meadow" id="top" aria-label="이달아 — 이달의 네일 아트">
      <div className="xp-hero-copy">
        <div className="xp-hero-pills" aria-hidden>
          <span className="xp-pill" suppressHydrationWarning>
            {issue.monthLabel}
          </span>
          <span className="xp-pill">
            {gated ? '초대받은 분만 · 예시는 자유롭게' : '가입 없이 · 하루 3회 무료'}
          </span>
        </div>
        <h1 className="xp-display xp-hero-title">
          사진 한 장이
          <br />
          이달의 네일이 돼요
        </h1>
        <p className="xp-hero-sub">
          영감 사진을 올리면 AI가 다섯 갈래 시안을 만들어요. 마음에 든 시안은 손에 올린 모습까지
          미리 볼 수 있어요.
        </p>
        <a className="xp-cta" href="#tool">
          {gated ? '초대 코드로 시작하기' : '무료로 시안 만들기'}
        </a>
      </div>

      {/* 카테고리 패널 행 — 맨 앞은 입력(영감 사진), 나머지는 이달의 시안 무드 */}
      <ul className="hero-panels" role="list">
        <li className="hero-panel hero-panel-input">
          <span className="hero-panel-label">영감 사진</span>
          <div className="hero-panel-stack" aria-hidden>
            {HERO_INSPO.slice(0, 3).map((cut) => (
              <img key={cut.src} src={cut.src} alt="" width={96} height={96} loading="eager" decoding="async" />
            ))}
          </div>
          <span className="hero-panel-meta">스크린샷·옷·하늘, 1–3장</span>
          <a className="hero-panel-plus" href="#tool" aria-label="영감 사진 올리러 가기">
            <span aria-hidden>+</span>
          </a>
        </li>
        {GALLERY.map((g) => (
          <li className="hero-panel" key={g.src}>
            <span className="hero-panel-label">{g.title}</span>
            <img
              className="hero-panel-img"
              src={g.src}
              alt={`이달의 시안 — ${g.title}`}
              width={320}
              height={320}
              loading="eager"
              decoding="async"
            />
            <span className="hero-panel-meta">{g.meta}</span>
            <a className="hero-panel-plus" href="#tool" aria-label={`${g.title} 무드로 시안 만들러 가기`}>
              <span aria-hidden>+</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
