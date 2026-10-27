import type { Metadata } from 'next';
import { auth } from '@/auth';
import Library from '@/components/Library';
import '../looks/looks.css';

/**
 * /library — 내 보관함. 결과 화면에서 '보관함에 저장'한 시안과 내 손 입혀보기 결과가 쌓인다.
 * 목록·삭제·만료 URL 처리는 components/Library.tsx 그대로 (예전엔 시작 화면 아래에 붙어 있었음).
 */
export const metadata: Metadata = {
  title: 'My Library · idala',
  robots: { index: false }, // 개인 페이지
};

export default async function LibraryPage() {
  // auth()는 환경변수가 빠지면 던질 수 있다 — 그때는 비로그인처럼 안내만 한다
  const session = await auth().catch(() => null);
  return (
    <div className="lk-page">
      <header className="lk-top">
        <a className="lk-back" href="/">
          idala<span aria-hidden>✳</span>
        </a>
        <a className="xp-pill lk-top-cta" href="/#tool">
          Make yours
        </a>
      </header>
      <main className="screen library-page">
        {session?.user ? (
          <Library />
        ) : (
          <p className="assurance">
            Sign in to see your library. <a className="btn-link" href="/#tool">Go to sign in</a>
          </p>
        )}
      </main>
    </div>
  );
}
