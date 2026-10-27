'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { FREE_CREDITS, PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

/**
 * 페이월 — 이용권이 없는 방문자에게 보여주는 툴 카드 내용.
 *
 * 로그인 안 했으면 먼저 로그인(누가 결제했는지 알아야 하므로),
 * 로그인했는데 남은 횟수가 없으면 가격 카드 + Paddle 결제창(오버레이).
 * 카드 입력은 전부 Paddle 결제창에서 — 이 화면은 금액만 보여준다.
 */

interface PaddleGlobal {
  Environment: { set(env: 'sandbox'): void };
  Initialize(opts: {
    token: string;
    eventCallback?: (e: { name?: string; data?: { transaction_id?: string } }) => void;
  }): void;
  Checkout: {
    open(opts: {
      transactionId: string;
      customer?: { email: string; address?: { countryCode: string } };
      settings?: { locale?: string };
    }): void;
  };
}

const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';
let paddleReady: Promise<PaddleGlobal> | null = null;

/** Paddle.js는 결제 버튼을 누를 때 한 번만 불러와 초기화한다 (랜딩 첫 로딩을 무겁게 하지 않게) */
function loadPaddle(token: string): Promise<PaddleGlobal> {
  if (!paddleReady) {
    paddleReady = new Promise<PaddleGlobal>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PADDLE_JS;
      s.onload = () => {
        const P = (window as unknown as { Paddle?: PaddleGlobal }).Paddle;
        if (!P) return reject(new Error('Paddle.js 로드 실패'));
        // 클라이언트 토큰 접두사로 환경을 가른다 (test_ = 샌드박스) — 서버 키와 같은 규칙
        if (token.startsWith('test_')) P.Environment.set('sandbox');
        P.Initialize({
          token,
          eventCallback: (e) => {
            // 결제 완료 → 서버가 거래를 직접 확인하는 페이지로. 웹훅이 늦어도 여기서 지급된다
            if (e.name === 'checkout.completed' && e.data?.transaction_id) {
              window.location.href = `/pay/success?txn=${encodeURIComponent(e.data.transaction_id)}`;
            }
          },
        });
        resolve(P);
      };
      s.onerror = () => {
        paddleReady = null; // 다음 클릭에 다시 시도
        reject(new Error('Paddle.js 로드 실패'));
      };
      document.head.appendChild(s);
    });
  }
  return paddleReady;
}

export default function Paywall({ email }: { email: string | null }) {
  const [starting, setStarting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const price = `₩${PRICE_REGULAR_KRW.toLocaleString('ko-KR')}`;

  const startCheckout = async () => {
    if (starting) return;
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN;
    if (!token) {
      setCheckoutError('Checkout is unavailable right now. Please try again in a moment.');
      return;
    }
    setStarting(true);
    setCheckoutError(null);
    try {
      const [paddle, res] = await Promise.all([
        loadPaddle(token),
        fetch('/api/checkout', { method: 'POST' }),
      ]);
      const json = await res.json().catch(() => null);
      if (res.ok && typeof json?.transactionId === 'string') {
        paddle.Checkout.open({
          transactionId: json.transactionId,
          // 한국어 결제창, 국가 기본값 한국(우편번호 입력 생략) — 손님 대부분이 국내 원장님
          ...(email ? { customer: { email, address: { countryCode: 'KR' } } } : {}),
          settings: { locale: 'ko' },
        });
        return;
      }
      setCheckoutError(
        json?.error === 'PAYMENT_UNAVAILABLE'
          ? 'Checkout is unavailable right now. Please try again in a moment.'
          : 'Couldn\'t open checkout. Please try again.',
      );
    } catch {
      setCheckoutError('Couldn\'t open checkout. Please try again.');
    } finally {
      setStarting(false);
    }
  };

  if (!email) {
    return (
      <div className="invite-gate">
        {/* 가입하면 무료 횟수가 들어온다(lib/accounts.ts) — 로그인 전 첫인상이 '유료'면 안 된다 */}
        <p className="invite-label">Sign in to get {FREE_CREDITS} free runs</p>
        <p className="assurance">
          No card needed · then {price} for {PACK_CREDITS} runs
        </p>
        {/* 로그인 버튼은 여기 하나뿐 — 아래 AccountBar는 비로그인일 때 동의 고지만 낸다 */}
        <div className="notify-row">
          <button className="btn-fill" type="button" onClick={() => void signIn('google')}>
            Continue with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-gate">
      <p className="invite-label">This month&apos;s nail pass</p>
      <p className="assurance">{PACK_CREDITS} runs · {price} · no subscription</p>
      <p className="assurance">1 run = 1 full set · failed runs don&apos;t count · deleted with your account</p>
      {checkoutError && (
        <div className="error-inline" role="alert">
          <p>{checkoutError}</p>
        </div>
      )}
      <div className="notify-row">
        <button className="btn-fill" type="button" onClick={startCheckout} disabled={starting}>
          {starting ? 'Opening checkout…' : `Start for ${price}`}
        </button>
      </div>
      <p className="assurance">
        Secure checkout by Paddle · KakaoPay &amp; Korean cards ·{' '}
        <a className="legal-link" href="/refund" target="_blank" rel="noopener noreferrer">
          Refunds
        </a>
        {' · '}
        <a className="legal-link" href="/terms" target="_blank" rel="noopener noreferrer">
          Terms
        </a>
      </p>
    </div>
  );
}
