'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

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
      setCheckoutError('지금은 결제를 시작할 수 없어요. 잠시 후 다시 시도해주세요.');
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
          {PACK_CREDITS}회 이용권 {price}
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
      <p className="assurance">{PACK_CREDITS}회 이용권 {price} · 구독 아님, 쓴 만큼만</p>
      <p className="assurance">1회 = 시안 세트 1번 · 실패한 회차는 차감 안 돼요 · 탈퇴하면 기록과 함께 지워져요</p>
      {checkoutError && (
        <div className="error-inline" role="alert">
          <p>{checkoutError}</p>
        </div>
      )}
      <div className="notify-row">
        <button className="btn-fill" type="button" onClick={startCheckout} disabled={starting}>
          {starting ? '결제창 여는 중…' : `${price}에 시작하기`}
        </button>
      </div>
      <p className="assurance">
        결제는 Paddle이 처리해요 · 카카오페이·국내 카드 가능 ·{' '}
        <a className="legal-link" href="/refund" target="_blank" rel="noopener noreferrer">
          환불 정책
        </a>
        {' · '}
        <a className="legal-link" href="/terms" target="_blank" rel="noopener noreferrer">
          이용약관
        </a>
      </p>
    </div>
  );
}
