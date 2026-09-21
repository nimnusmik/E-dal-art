import type { Metadata, Viewport } from 'next';
import { Archivo_Black, Black_Han_Sans } from 'next/font/google';
import './globals.css';
import './landing.css';

/* 디스플레이 폰트 2종은 next/font 셀프호스팅 — 렌더 블로킹 외부 CSS 요청을 없앤다.
   Pretendard는 동적 서브셋 CDN이 셀프호스팅보다 유리해 그대로 둔다. */
const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-archivo',
});
const blackHanSans = Black_Han_Sans({
  weight: '400',
  // 한글 글리프는 unicode-range 분할로 포함된다 — preload는 라틴만
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-bhs',
});

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
  // 히어로 상단 하늘 실측 평균(#00b0fd) — 모바일 브라우저 크롬이 첫 화면과 이어진다
  themeColor: '#00b0fd',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={`${archivoBlack.variable} ${blackHanSans.variable}`}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
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
