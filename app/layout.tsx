import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '이달아 — 이달의 네일 아트',
  description: '영감 사진을 올리면, 이달의 네일 아트 시안이 나와요',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FCFAF7',
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
        {/* 에디토리얼 세리프 디스플레이 — 헤드라인·발행호 전용 (MaruBuri, 네이버 무료 배포) */}
        <link rel="preconnect" href="https://hangeul.pstatic.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://hangeul.pstatic.net/hangeul_static/css/maru-buri.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
