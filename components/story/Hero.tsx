'use client';

import { useGate } from '@/lib/useGate';
import { useIssue } from '@/lib/useIssue';
import { GALLERY } from '@/components/landing/content';
import { HERO_INSPO } from './heroInspo';

/**
 * 다크 히어로 — 초대형 라이트 타이포 + "영감 사진 → 시안" 변환 스트립.
 *
 * 손 모핑 무대(HeroHand)를 대체한다: 제품의 핵심 서사(사진을 넣으면 네일 시안이
 * 나온다)를 착용샷이 아니라 입력→출력 자체로 보여준다. 재료는 전부 기존 에셋 —
 * 왼쪽은 영감 컷(heroInspo), 오른쪽은 실제 검수 통과 시안(GALLERY)이라
 * "이런 게 나와요"라는 주장이 히어로에서부터 참이다.
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

      {/* 입력 → 출력 스트립. 스크린리더에는 흐름을 문장으로 전달한다 */}
      <div className="hero-flow" role="img" aria-label="영감 사진 세 장이 이달의 네일 시안 네 종으로 바뀌는 과정">
        <div className="hero-flow-group">
          <ul className="hero-flow-in" role="list" aria-hidden>
            {HERO_INSPO.slice(0, 3).map((cut) => (
              <li key={cut.src}>
                <img src={cut.src} alt="" width={96} height={96} loading="eager" decoding="async" />
              </li>
            ))}
          </ul>
          <span className="hero-flow-cap" aria-hidden>영감 사진 1–3장</span>
        </div>
        <div className="hero-flow-arrow" aria-hidden>
          <span className="hero-flow-arrow-line" />
          <span className="hero-flow-arrow-label">AI 5종 변주</span>
        </div>
        <div className="hero-flow-group">
          <ul className="hero-flow-out" role="list" aria-hidden>
            {GALLERY.map((g) => (
              <li key={g.src}>
                <img src={g.src} alt="" width={150} height={150} loading="eager" decoding="async" />
              </li>
            ))}
          </ul>
          <span className="hero-flow-cap" aria-hidden>이달의 시안 — 실제 검수 통과작</span>
        </div>
      </div>

    </section>
  );
}
