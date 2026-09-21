'use client';

import { useState } from 'react';

/**
 * 유료 구독 수요 측정 ("가짜 가격 버튼").
 *
 * 승인된 검증 설계의 2단계 게이트 — 방문 200 기준 이 버튼의 클릭률이 3% 미만이면
 * B2C 트랙을 접는다. 이 장치가 없으면 배포는 됐어도 판정할 수 있는 가설이 하나도 없다.
 *
 * 정직성 규칙: 결제는 없고, 누르는 즉시 "아직 준비 중"임을 밝힌다. 가격을 보여주고
 * 의사만 묻는 것이라 구매로 오인될 여지를 남기지 않는다. 이메일은 서버에 저장하지 않고
 * 신청 건수만 센다(개인정보 처리방침·동의 절차가 아직 없으므로).
 */

const PRICE_LABEL = '₩4,900/mo';

function track(event: 'price' | 'notify'): void {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

export default function PriceProbe(): React.ReactElement {
  const [opened, setOpened] = useState(false);
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <div className="price-probe">
        <p className="assurance">
          You're on the list — we'll email you when it opens.
        </p>
      </div>
    );
  }

  return (
    <div className="price-probe">
      <p className="price-probe-head">Ten curated sets in your inbox, monthly?</p>
      <p className="assurance">
        Numbered sets with pricing & booking captions, plus a ready-to-post Instagram pack — on the 25th of every month.
      </p>
      {/* "무료"(FAQ·통계 카드)와 이 가격이 한 페이지에 있으면 경계를 말해줘야 한다 */}
      <p className="assurance">
        Creating stays free. The subscription is an optional monthly drop.
      </p>
      {opened ? (
        <form
          className="notify-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!email.trim()) return;
            track('notify');
            setDone(true);
          }}
        >
          <label className="assurance" htmlFor="price-email">
            It's not open yet — want a heads-up?
          </label>
          <div className="notify-row">
            <input
              id="price-email"
              className="notify-input"
              type="email"
              autoComplete="email"
              required
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-fill" type="submit">
              Notify me
            </button>
          </div>
        </form>
      ) : (
        <button
          className="btn-fill price-probe-cta"
          onClick={() => {
            track('price');
            setOpened(true);
          }}
        >
          Subscribe · {PRICE_LABEL}
        </button>
      )}
    </div>
  );
}
