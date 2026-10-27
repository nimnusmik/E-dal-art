import { notFound } from 'next/navigation';
import GenPreview from './GenPreview';

/** /dev/generating?stage=analyzing|variants&done=0~3 — 생성 중 화면 미리보기 (개발 전용, 운영 404) */
export default function DevGeneratingPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <GenPreview />;
}
