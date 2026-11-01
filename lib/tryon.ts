import { fetchImage, runTask, uploadImage, YouCamError } from './youcam';
import { isMock } from './mock';
import type { ImagePayload } from './types';

/**
 * 내 손에 입혀보기 — 사용자 손 사진 + 고른 팁셋 → 손톱만 바뀐 사진.
 * YouCam AI Nail Transfer(1 unit/회): 손 사진(src)에 참고 사진(ref)의 네일 디자인을 옮긴다.
 * 손톱 찾기·합성을 YouCam이 다 해서, 예전 SAM 마스크 + Muse 합성(main 브랜치)이 필요 없다.
 */

export class NoNailsError extends Error {}

export async function tryOn(hand: ImagePayload, tipSet: ImagePayload): Promise<ImagePayload> {
  if (isMock()) return hand;

  const [src_file_id, ref_file_id] = await Promise.all([uploadImage(hand, 'hand'), uploadImage(tipSet, 'design')]);
  try {
    const { url } = await runTask<{ url: string }>('ai-nail', { src_file_id, ref_file_id });
    return await fetchImage(url);
  } catch (e) {
    if (e instanceof YouCamError && e.code === 'no_hand_detected') throw new NoNailsError();
    throw e;
  }
}
