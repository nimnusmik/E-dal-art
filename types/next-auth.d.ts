import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      /** 구글 sub — 계정을 구분하는 안정적 키 (이메일은 바뀔 수 있다) */
      id: string;
      email?: string | null;
    };
  }
}
