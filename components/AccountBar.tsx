'use client';

import { signOut } from 'next-auth/react';

/**
 * 툴 카드 안의 로그인 줄.
 *
 * 전용 로그인 페이지를 만들지 않는다 — 툴 카드 안에서 바로 누르게 한다.
 * 생성에는 로그인+이용권이 필요하므로, 비로그인 상태의 문구도 그에 맞춘다.
 */
/** 화면에는 앞 2글자만 — 화면 녹화·공유 때 이메일이 그대로 찍혔다 (2026-11-01) */
const maskEmail = (email: string) => email.replace(/^(.{2})[^@]*/, '$1•••');

export default function AccountBar({ email }: { email: string | null }) {
  if (email) {
    return (
      <div className="account-bar">
        <span className="account-who">
          <span className="account-dot" aria-hidden />
          <span title="Signed in">{maskEmail(email)}</span>
        </span>
        <a className="btn-link" href="/library">
          My Library
        </a>
        <button className="btn-link" onClick={() => void signOut({ redirectTo: '/' })}>
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="account-bar is-out">
      {/* 로그인 버튼은 Paywall 하나뿐 — 같은 카드에 구글 버튼이 두 개 있었다 */}
      {/* 동의 고지 — 이메일을 받기 시작하는 순간 필요한 최소 절차 */}
      <p className="assurance account-consent">
        Signing in means you agree to the{' '}
        <a className="legal-link" href="/privacy" target="_blank" rel="noopener noreferrer">
          privacy policy
        </a>
        . We only receive your Google account email. No name, no profile photo. 14+ only.
      </p>
    </div>
  );
}
