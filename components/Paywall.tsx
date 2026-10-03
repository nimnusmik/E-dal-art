'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

/**
 * 페이월 — 이용권이 없는 방문자에게 보여주는 툴 카드 내용.
 *
 * 로그인 안 했으면 먼저 로그인(누가 결제했는지 알아야 하므로),
 * 로그인했는데 미결제면 가격 카드 + Stripe Checkout 버튼.
 * 카드 입력은 전부 Stripe 호스팅 페이지에서 — 이 화면은 금액만 보여준다.
 */
export default function Paywall({
  email,
  earlyBirdLeft,
  priceRegular,
  priceEarly,
}: {
  email: string | null;
  earlyBirdLeft: number | null;
  priceRegular: number;
  priceEarly: number;
}) {
  const [starting, setStarting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const earlyBird = earlyBirdLeft !== null && earlyBirdLeft > 0;
  const price = earlyBird ? priceEarly : priceRegular;
  const fmt = (n: number) => `₩${n.toLocaleString('ko-KR')}`;

  const startCheckout = async () => {
    if (starting) return;
    setStarting(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/checkout', { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (res.ok && json?.url) {
        window.location.href = json.url as string;
        return;
      }
      if (json?.error === 'ALREADY_PAID') {
        // 다른 탭에서 이미 결제됨 — 새로고침하면 열린다
        window.location.reload();
        return;
      }
      setCheckoutError(
        json?.error === 'PAYMENT_UNAVAILABLE'
          ? '지금은 결제를 시작할 수 없어요. 잠시 후 다시 시도해주세요.'
          : '결제 시작에 실패했어요. 다시 시도해주세요.',
      );
    } catch {
      setCheckoutError('결제 시작에 실패했어요. 다시 시도해주세요.');
    } finally {
      setStarting(false);
    }
  };

  if (!email) {
    return (
      <div className="invite-gate">
        <p className="invite-label">이용권으로 열리는 이달의 네일</p>
        <p className="assurance">
          {earlyBird
            ? `얼리버드 ${fmt(priceEarly)} · 선착순 100명 중 ${earlyBirdLeft}명 남음`
            : `평생 이용권 ${fmt(priceRegular)}`}
        </p>
        <div className="notify-row">
          <button className="btn-fill" type="button" onClick={() => void signIn('google')}>
            Google로 로그인하고 시작하기
          </button>
        </div>
        <p className="assurance">
          로그인은 누가 결제했는지 확인하기 위해서만 써요. 이름·사진은 받지 않아요.
        </p>
      </div>
    );
  }

  return (
    <div className="invite-gate">
      <p className="invite-label">이달의 네일 이용권</p>
      {earlyBird ? (
        <p className="assurance">
          얼리버드 {fmt(priceEarly)}{' '}
          <s>{fmt(priceRegular)}</s> · 선착순 100명 중 {earlyBirdLeft}명 남음
        </p>
      ) : (
        <p className="assurance">평생 이용권 {fmt(priceRegular)} · 한 번만 결제해요</p>
      )}
      <p className="assurance">하루 3회 생성 · 평생 이용 · 언제든 탈퇴하면 기록과 함께 지워져요</p>
      {checkoutError && (
        <div className="error-inline" role="alert">
          <p>{checkoutError}</p>
        </div>
      )}
      <div className="notify-row">
        <button className="btn-fill" type="button" onClick={startCheckout} disabled={starting}>
          {starting ? '결제 페이지로 이동 중…' : `${fmt(price)}에 시작하기`}
        </button>
      </div>
      <p className="assurance">결제는 Stripe에서 안전하게 처리돼요. 카드번호는 이달아를 거치지 않아요.</p>
    </div>
  );
}
