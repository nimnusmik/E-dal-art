import type { ImagePayload } from './types';

export function fitWithin(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height };
  const scale = maxDim / Math.max(width, height);
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** 브라우저 전용: 업로드 파일 → 축소된 JPEG base64 + 미리보기 URL */
export async function fileToResizedPayload(
  file: File,
  maxDim = 1024,
): Promise<ImagePayload & { previewUrl: string }> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxDim);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  return {
    data: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mimeType: 'image/jpeg',
    previewUrl: dataUrl,
  };
}
