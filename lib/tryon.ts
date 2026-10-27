import sharp from 'sharp';
import { callMuseImage } from './museimage';
import { mergeMasks, segment } from './sam';
import { isMock } from './mock';
import type { ImagePayload } from './types';

/**
 * 내 손에 입혀보기 — 사용자 손 사진 + 고른 팁셋 → 손톱만 바뀐 사진.
 *
 * Muse Image는 손 전체를 새로 그려서 피부·자세가 미묘하게 '남의 손'이 된다 (2026-10-27 실측).
 * 그래서 SAM 3.1로 원본 손의 손톱 픽셀을 찾고, 그 자리에만 Muse 결과를 붙인다.
 * 손톱 밖 픽셀은 원본 그대로 — 사용자가 올린 손이 결과에서도 정확히 같은 손이다.
 */

const PROMPT =
  'Apply the nail designs from the second image onto all five fingernails of the hand in the first image, ' +
  'one design per nail, matching each nail\'s shape and curvature. ' +
  'Keep the hand, skin, finger pose, framing, lighting and background exactly the same. Only the fingernails change.';

export class NoNailsError extends Error {}

export async function tryOn(hand: ImagePayload, tipSet: ImagePayload): Promise<ImagePayload> {
  if (isMock()) return hand;

  const handBuf = Buffer.from(hand.data, 'base64');
  const { width: W, height: H } = (await sharp(handBuf).metadata()) as { width: number; height: number };

  // 둘은 서로 독립 — 병렬로 (Muse Image가 약 20초로 느린 쪽)
  const [nails, edit] = await Promise.all([
    segment(hand, 'fingernail'),
    callMuseImage([hand, tipSet], PROMPT),
  ]);
  if (nails.length === 0) throw new NoNailsError();
  if (!edit.image) throw new Error(edit.safetyBlocked ? 'safety' : 'empty');

  // 마스크를 3px 키우고 가장자리를 흐림 — Muse가 그린 손톱과 원본 손톱의 미세한 위치 차이·계단 현상을 가린다
  const mask = await sharp(Buffer.from(mergeMasks(nails, W, H)), { raw: { width: W, height: H, channels: 1 } })
    .dilate(3)
    .blur(1.5)
    .extractChannel(0) // sharp가 중간에 3채널로 바꾼다 — 1채널로 되돌리지 않으면 행이 밀려 줄무늬가 생김
    .raw()
    .toBuffer();
  // ponytail: Muse 결과를 원본 크기로 늘려 그대로 겹침. 손 위치가 크게 어긋나는 사진이 나오면 손톱별 박스 정렬로
  const edited = await sharp(Buffer.from(edit.image.data, 'base64')).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const nailsOnly = await sharp(edited, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(mask, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();
  const out = await sharp(handBuf).composite([{ input: nailsOnly }]).jpeg({ quality: 90 }).toBuffer();
  return { data: out.toString('base64'), mimeType: 'image/jpeg' };
}
