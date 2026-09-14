import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

/**
 * 구글 로그인 (Auth.js v5).
 *
 * 설계 원칙 세 가지 — 전부 "안 가진 것은 잃을 수 없다"에서 나온다.
 *
 * 1. **DB를 쓰지 않는다.** 계정 체계와 데이터베이스는 다른 문제다. 구글이 "이 사람은
 *    sub=1078... 입니다"라고 알려주면 그 식별자를 서명된 HttpOnly 쿠키에 담으면 끝이다.
 *    쿼터는 기존 Upstash Redis가 그대로 센다. 새 벤더 0개, 새 요금 0원.
 *    (되돌릴 수 없는 데이터 — 결제·보관함 — 가 생기는 시점에 Postgres를 도입한다.)
 *
 * 2. **scope는 openid email만.** 이름·프로필 사진을 아예 받지 않는다. 화면에 쓸 데가
 *    없고, 안 받은 개인정보는 지킬 필요도 고지할 필요도 파기할 필요도 없다.
 *
 * 3. **구글 토큰을 저장하지 않는다.** 이 앱은 구글 캘린더나 드라이브를 쓰지 않는다.
 *    로그인 시점에 "누구인지"만 확인하고 access/refresh 토큰은 버린다.
 *
 * 알려진 한계: DB 세션 테이블이 없으므로 "특정 사용자만 강제 로그아웃"이 불가능하다.
 * 유일한 수단은 AUTH_SECRET 교체이고 그러면 전원이 로그아웃된다. 수백 명까지는
 * 감당 가능한 트레이드오프로 보고 수명을 7일로 짧게 잡았다.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: { params: { scope: 'openid email' } },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 24 * 7, // 7일 (기본 30일은 이 단계에 과하다)
  },
  callbacks: {
    /**
     * JWT에 담는 것은 구글 sub와 이메일뿐.
     * JWT는 가진 사람이 다 읽을 수 있으므로 등급·결제 정보 같은 것을 넣지 않는다.
     */
    async jwt({ token, profile }) {
      if (profile?.sub) {
        token.sub = profile.sub;
        // 계정 기록은 실패해도 로그인을 막지 않는다 (lib/accounts.ts 주석 참조)
        const { upsertAccount } = await import('@/lib/accounts');
        await upsertAccount(profile.sub, profile.email ?? token.email ?? '');
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? '';
      return session;
    },
  },
  pages: {
    // 전용 로그인 페이지를 만들지 않는다 — 툴 카드 안에서 바로 누르게 한다
    signIn: '/',
  },
});
