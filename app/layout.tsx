import type { Metadata, Viewport } from 'next';
import './globals.css';
import './landing.css';

export const metadata: Metadata = {
  title: '이달아 — 이달의 네일 아트',
  description: '영감 사진을 올리면, 이달의 네일 아트 시안이 나와요',
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
      </head>
      <body>{children}</body>
    </html>
  );
}
