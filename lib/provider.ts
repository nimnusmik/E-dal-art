import type { ImageOutcome, ImagePayload } from './types';
import { callGemini } from './gemini';
import { callSeedream } from './seedream';

export type ImageProviderName = 'gemini' | 'seedream';

/** IMAGE_PROVIDER 환경변수로 공급자 선택 (기본 gemini) */
export function imageProvider(): ImageProviderName {
  return process.env.IMAGE_PROVIDER === 'seedream' ? 'seedream' : 'gemini';
}

/** 선택된 공급자로 이미지 1장 생성 */
export function generateImage(images: ImagePayload[], prompt: string): Promise<ImageOutcome> {
  return imageProvider() === 'seedream' ? callSeedream(images, prompt) : callGemini(images, prompt);
}
