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
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="account-bar is-out">
      <div className="account-pitch">
        <button className="btn-outline account-cta" onClick={() => void signIn('google')}>
          Sign in with Google
        </button>
        <p className="assurance">
          Sign in and your remaining runs
          {remaining !== null ? ` (${remaining})` : ''} follow you across devices.
          You can keep using idala without signing in.
        </p>
      </div>
      {/* 동의 고지 — 이메일을 받기 시작하는 순간 필요한 최소 절차 */}
      <p className="assurance account-consent">
        Signing in means you agree to the{' '}
        <a className="legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">
          privacy policy
        </a>
        . We only receive your Google account email — no name, no profile photo. 14+ only.
      </p>
    </div>
  );
}
