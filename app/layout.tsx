import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '이달아 — 이달의 네일 아트',
  description: '영감 사진을 올리면, 이달의 네일 아트 시안이 나와요',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
