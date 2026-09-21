import type { Metadata, Viewport } from 'next';
import './globals.css';
import './landing.css';

/* 2026-09-20 무드 개편: 디스플레이도 Pretendard 300 — 별도 디스플레이 폰트 없음.
   Pretendard 동적 서브셋 CDN 하나가 전체 타이포를 감당한다. */

// NEXT_PUBLIC_SITE_URL이 빠져도 프로덕션 OG가 localhost로 떨어지지 않게
// Vercel이 주입하는 프로덕션 도메인을 2차 폴백으로 쓴다.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : 'http://localhost:3000');
const TITLE = '이달아 — 이달의 네일 아트';
const DESCRIPTION = '영감 사진을 올리면, 이달의 네일 아트 시안이 나와요';
const OG_DESCRIPTION = '영감 사진 한 장으로 이달의 네일 시안 5종을 만들어요. 실제로 만들어 검수를 통과한 시안 예시를 볼 수 있어요.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // 카카오톡·인스타 공유가 사실상 유일한 유통 경로 — OG가 없으면 URL만 덜렁 나간다
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: '이달아',
    title: TITLE,
    description: OG_DESCRIPTION,
    url: '/',
    images: [{ url: '/og.jpg', width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: OG_DESCRIPTION,
    images: ['/og.jpg'],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // 다크 히어로 지면 — 모바일 브라우저 크롬이 첫 화면과 이어진다
  themeColor: '#020109',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 히어로 변환 스트립의 시안 4종이 LCP 후보 — 가장 큰 첫 장만 미리 받는다 */}
        <link rel="preload" as="image" href="/gallery/pastel-french.jpg" fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
