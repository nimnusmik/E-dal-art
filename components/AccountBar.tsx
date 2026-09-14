'use client';

import { signIn, signOut } from 'next-auth/react';

/**
 * 툴 카드 안의 로그인 줄.
 *
 * 전용 로그인 페이지를 만들지 않는다 — 계정이 주는 이득이 아직 "한도가 기기·네트워크를
 * 따라온다" 하나뿐이라, 별도 화면으로 띄우면 얻는 것에 비해 과한 연출이 된다.
 *
 * 과장하지 않는 것이 중요하다. 지금은 생성물을 저장하지 않으므로 "내 보관함" 같은 약속을
 * 하면 거짓이 된다. 실제로 되는 것만 적는다.
 */
export default function AccountBar({
  email,
  remaining,
}: {
  /** 로그인 상태면 이메일, 아니면 null */
  email: string | null;
  remaining: number | null;
}) {
  if (email) {
    return (
      <div className="account-bar">
        <span className="account-who">
          <span className="account-dot" aria-hidden />
          {email}
        </span>
        <button className="btn-link" onClick={() => void signOut({ redirectTo: '/' })}>
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="account-bar is-out">
      <div className="account-pitch">
        <button className="btn-outline account-cta" onClick={() => void signIn('google')}>
          구글로 로그인
        </button>
        <p className="assurance">
          로그인하면 오늘 남은 횟수
          {remaining !== null ? `(${remaining}회)` : ''}가 기기나 네트워크가 바뀌어도
          따라와요. 로그인하지 않아도 그대로 쓸 수 있어요.
        </p>
      </div>
      {/* 동의 고지 — 이메일을 받기 시작하는 순간 필요한 최소 절차 */}
      <p className="assurance account-consent">
        로그인하면{' '}
        <a className="legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">
          개인정보 처리방침
        </a>
        에 동의하는 것으로 봅니다. 구글 계정의 이메일만 받고 이름·프로필 사진은 받지
        않아요. 만 14세 이상만 이용할 수 있어요.
      </p>
    </div>
  );
}
