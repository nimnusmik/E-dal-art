import type { ImageOutcome, ImagePayload } from './types';

/**
 * Meta Muse Image — OpenAI Images API와 같은 형식(/v1/images/edits). IMAGE_PROVIDER=muse 일 때 사용.
 * MODEL_API_KEY 필수. 장당 $0.01. 영감 사진 여러 장을 넣어 합성·편집한다.
 * gptimage.ts와 구조가 같고 주소·모델·키만 다르다 (quality·size 옵션은 미확인이라 보내지 않음).
 */

const API_URL = 'https://api.meta.ai/v1/images/edits';

function ext(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

export function sniffMime(b64: string): string {
  const head = Buffer.from(b64.slice(0, 24), 'base64');
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  if (head[0] === 0xff && head[1] === 0xd8) return 'image/jpeg';
  return 'image/png';
}

export async function callMuseImage(images: ImagePayload[], prompt: string): Promise<ImageOutcome> {
  const key = process.env.MODEL_API_KEY;
  if (!key) throw new Error('MODEL_API_KEY 없음');
  if (images.length === 0) throw new Error('Muse Image 편집에는 입력 이미지가 1장 이상 필요');

  const form = new FormData();
  form.append('model', process.env.MUSE_IMAGE_MODEL || 'muse-image-1.0');
  form.append('prompt', prompt);
  // OpenAI와 달리 image[]가 아니라 image[0], image[1]… 번호를 요구한다 (400 실측)
  images.forEach((img, i) => {
    const bytes = Buffer.from(img.data, 'base64');
    form.append(`image[${i}]`, new Blob([bytes], { type: img.mimeType }), `input${i}.${ext(img.mimeType)}`);
  });

  const res = await fetch(API_URL, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  const json = (await res.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok) {
    const code = json?.error?.code ?? '';
    const msg = json?.error?.message ?? '';
    if (/content_policy|safety/i.test(code) || /content policy|inappropriate|safety/i.test(msg)) {
      return { image: null, mood: null, safetyBlocked: true };
    }
    throw new Error(`Muse images/edits ${res.status}: ${code} ${msg}`.trim());
  }

  const item = json?.data?.[0];
  let b64 = item?.b64_json ?? null;
  let mimeType = 'image/png';
  if (!b64 && item?.url) {
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`Muse images/edits: 결과 다운로드 실패 ${imgRes.status}`);
    b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
    mimeType = imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
  }
  if (!b64) throw new Error('Muse images/edits: 빈 응답');
  // b64_json은 형식을 안 알려주는데 실제로는 webp가 온다 — png로 표시하면 이 이미지를 다시 Muse에
  // 넣을 때 "MIME 불일치" 400 (2026-10-27 실측). 파일 앞부분(매직 넘버)으로 판별한다
  if (item?.b64_json) mimeType = sniffMime(b64);
  return { image: { data: b64, mimeType }, mood: null, safetyBlocked: false };
}
