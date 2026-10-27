import { notFound } from 'next/navigation';
import Preview from './Preview';

/**
 * /dev/result — 결과 화면 디자인 미리보기 (개발 전용).
 * 실제 결과 화면은 로그인·이용권·생성이 필요해 UI를 다듬을 때마다 돈과 시간이 든다.
 * 운영 빌드에서는 404.
 */
export default function DevResultPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <Preview />;
}
