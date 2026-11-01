import sharp from 'sharp';
import { fetchImage, runTask, uploadImage, YouCamError } from './youcam';
import { isMock } from './mock';
import type { ImagePayload } from './types';

/**
 * 내 손에 입혀보기 — 사용자 손 사진 + 고른 팁셋 → 손톱만 바뀐 사진.
 * YouCam AI Nail Transfer(1 unit/회): 손 사진(src)에 참고 사진(ref)의 네일 디자인을 옮긴다.
 * 손톱 찾기·합성을 YouCam이 다 해서, 예전 SAM 마스크 + Muse 합성(main 브랜치)이 필요 없다.
 */

export class NoNailsError extends Error {}

/**
 * 팁셋(팁 10개, 5개×2줄) → YouCam 참고 사진: 첫 줄 5개만 오려 피부색 바탕에 나란히.
 * 실측(2026-11-01): 팁 10개 그대로는 손가락마다 길이가 제각각, 회색 바탕 한 줄은 디자인이 흐려짐,
 * '피부 위에 팁 5개'가 가장 고르게 옮겨졌다. AI 착용샷은 디자인이 바뀌어 와서 못 씀.
 */
export async function buildReference(tipSet: ImagePayload): Promise<ImagePayload> {
  const img = sharp(Buffer.from(tipSet.data, 'base64')).rotate().removeAlpha();
  const { width: W, height: H } = (await img.metadata()) as { width: number; height: number };
  // ponytail: 팁셋이 항상 2줄이라는 가정. 줄 수가 바뀌면 행 투영으로 줄 경계를 찾을 것
  const row = await img.extract({ left: 0, top: 0, width: W, height: Math.round(H / 2) }).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = row.info;
  const px = row.data;
  // 바탕색 = 네 모서리 평균 — 생성 이미지는 단색에 가까운 바탕
  const corners = [0, w - 1, (h - 1) * w, h * w - 1].map((i) => [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]]);
  const bg = [0, 1, 2].map((c) => corners.reduce((a, k) => a + k[c], 0) / 4);
  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) {
    const d = Math.hypot(px[i * 3] - bg[0], px[i * 3 + 1] - bg[1], px[i * 3 + 2] - bg[2]);
    alpha[i] = Math.max(0, Math.min(255, (d - 12) * 12)); // 바탕과 거리 12 이하는 투명, 33 이상은 불투명
  }
  const tips = await sharp(px, { raw: { width: w, height: h, channels: 3 } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } })
    .png()
    .toBuffer();
  const trimmed = await sharp(tips).trim().png().toBuffer();
  const out = await sharp({ create: { width: w, height: Math.round(h * 1.3), channels: 3, background: '#d8a98e' } })
    .composite([{ input: trimmed, gravity: 'center' }])
    .jpeg({ quality: 92 })
    .toBuffer();
  return { data: out.toString('base64'), mimeType: 'image/jpeg' };
}

export async function tryOn(hand: ImagePayload, tipSet: ImagePayload): Promise<ImagePayload> {
  if (isMock()) return hand;

  const [src_file_id, ref_file_id] = await Promise.all([uploadImage(hand, 'hand'), uploadImage(await buildReference(tipSet), 'design')]);
  try {
    const { url } = await runTask<{ url: string }>('ai-nail', { src_file_id, ref_file_id });
    return await fetchImage(url);
  } catch (e) {
    if (e instanceof YouCamError && e.code === 'no_hand_detected') throw new NoNailsError();
    throw e;
  }
}
