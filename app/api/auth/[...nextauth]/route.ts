import { handlers } from '@/auth';

/** Auth.js 콜백 엔드포인트. 구글 리다이렉트 URI는 /api/auth/callback/google 이다. */
export const { GET, POST } = handlers;
