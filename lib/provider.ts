import type { ImageOutcome, ImagePayload } from './types';
import { callGemini } from './gemini';
import { callSeedream } from './seedream';
import { callGptImage } from './gptimage';

export type ImageProviderName = 'gemini' | 'seedream' | 'gptimage';

/** IMAGE_PROVIDER 환경변수로 공급자 선택 (기본 gemini) */
export function imageProvider(): ImageProviderName {
  const v = process.env.IMAGE_PROVIDER;
  if (v === 'seedream') return 'seedream';
  if (v === 'gptimage') return 'gptimage';
  return 'gemini';
}

/** 선택된 공급자로 이미지 1장 생성. quality는 gptimage만 지원 (gemini·seedream은 무시) */
export function generateImage(
  images: ImagePayload[],
  prompt: string,
  opts?: { quality?: 'low' | 'medium' | 'high' },
): Promise<ImageOutcome> {
  switch (imageProvider()) {
    case 'seedream':
      return callSeedream(images, prompt);
    case 'gptimage':
      return callGptImage(images, prompt, opts?.quality);
    default:
      return callGemini(images, prompt);
  }
}
