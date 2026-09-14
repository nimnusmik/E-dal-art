import type { Metadata, Viewport } from 'next';
import './globals.css';
import './landing.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
const TITLE = '이달아 — 이달의 네일 아트';
const DESCRIPTION = '영감 사진을 올리면, 이달의 네일 아트 시안이 나와요';
const OG_DESCRIPTION = '영감 사진 한 장으로 이달의 네일 시안 5종을 만들어요. 가입 없이 무료.';

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
  themeColor: '#5aa9e6',
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
        {/* 초대형 디스플레이 — 라틴(Archivo Black) + 한글(Black Han Sans) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Black+Han+Sans&display=swap"
        />
        {/* LCP 후보. CSS background-image라 브라우저가 landing.css를 파싱하고 해당 요소가
            레이아웃될 때까지 발견조차 못 한다 — 조건 없이 미리 받아 발견 시점을 HTML
            파싱 시점으로 끌어올린다. 모바일은 좁은 폭 전용본을 따로 받는다 */}
        <link
          rel="preload"
          as="image"
          href="/landing/meadow-mobile.jpg"
          media="(max-width: 767px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/landing/meadow.jpg"
          media="(min-width: 768px)"
          fetchPriority="high"
        />
        <link rel="preload" as="image" href="/hero/hand.webp" fetchPriority="high" />
        {/* 모션 저감 사용자에게는 완성컷이 첫 화면 이미지가 되므로 미리 받는다 */}
        <link
          rel="preload"
          as="image"
          href="/hero/hand-after.webp"
          media="(prefers-reduced-motion: reduce)"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
