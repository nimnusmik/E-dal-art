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

const PRICE_LABEL = '월 4,900원';

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
          알림 신청이 접수됐어요. 구독이 열리면 알려드릴게요.
        </p>
      </div>
    );
  }

  return (
    <div className="price-probe">
      <p className="price-probe-head">이달의 아트 10종 세트를 매달 받아볼까요?</p>
      <p className="assurance">
        번호·가격·예약 문구까지 붙은 세트와 인스타 게시물을 매달 25일에 보내드려요.
      </p>
      {/* "무료"(FAQ·통계 카드)와 이 가격이 한 페이지에 있으면 경계를 말해줘야 한다 */}
      <p className="assurance">
        시안 만들기는 계속 무료예요. 구독은 완성된 세트를 받아보는 선택이에요.
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
            아직 준비 중이에요. 열리면 알려드릴까요?
          </label>
          <div className="notify-row">
            <input
              id="price-email"
              className="notify-input"
              type="email"
              autoComplete="email"
              required
              placeholder="이메일 주소"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn-fill" type="submit">
              신청
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
          {PRICE_LABEL}으로 구독하기
        </button>
      )}
    </div>
  );
}
