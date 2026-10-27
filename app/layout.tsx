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
const TITLE = 'idala: nail sets from your inspiration photos';
const DESCRIPTION = 'Drop in an inspiration photo and get a salon-ready nail set, then try it on your own hand.';
const OG_DESCRIPTION = 'One inspiration photo becomes three nail sets, quality-checked and ready to try on your own hand.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  // 카카오톡·인스타 공유가 사실상 유일한 유통 경로 — OG가 없으면 URL만 덜렁 나간다
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'idala',
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 히어로 LCP 후보 — 모바일 증거 줄·폰 완성본·데스크톱 패널 첫 장이 모두 이 사진 */}
        <link rel="preload" as="image" href="/gallery/pastel-french.jpg" fetchPriority="high" />
      </head>
      <body>{children}</body>
    </html>
  );
}
