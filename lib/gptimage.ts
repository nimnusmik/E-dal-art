import type { ImageOutcome, ImagePayload } from './types';

/**
 * OpenAI GPT 이미지 — 영감 사진을 입력으로 받는 이미지 편집 방식.
 *
 * IMAGE_PROVIDER=gptimage 일 때 사용. OPENAI_API_KEY 필수.
 * Seedream과 마찬가지로 무드 키워드/색상은 반환하지 않으므로 mood는 null이다.
 * (README "공급자 차이" 섹션 참조)
 */

const API_URL = 'https://api.openai.com/v1/images/edits';

function apiKey(): string | null {
  return process.env.OPENAI_API_KEY || null;
}

function model(): string {
  // gpt-image-1은 구형(단종 예정). 현재 라인업: gpt-image-1-mini(저렴), gpt-image-1.5, gpt-image-2/2.5(최신)
  return process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1.5';
}

function size(): string {
  return process.env.OPENAI_IMAGE_SIZE || '1024x1024';
}

function ext(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  return 'jpg';
}

export async function callGptImage(
  images: ImagePayload[],
  prompt: string,
  quality?: 'low' | 'medium' | 'high',
): Promise<ImageOutcome> {
  const key = apiKey();
  if (!key) throw new Error('OPENAI_API_KEY 없음');
  if (images.length === 0) throw new Error('gpt-image 편집에는 입력 이미지가 1장 이상 필요');

  const form = new FormData();
  form.append('model', model());
  form.append('prompt', prompt);
  form.append('size', size());
  // 기본 medium — 미지정이면 auto(≈high, 장당 $0.133)로 과금되므로 원가 통제를 위해 명시.
  // 하이브리드: 시안은 medium(기본), 착용샷(/api/hero)만 high를 넘긴다.
  form.append('quality', quality ?? process.env.OPENAI_IMAGE_QUALITY ?? 'medium');
  // response_format은 edits 엔드포인트에서 미지원 — 모델 기본 형식(b64_json 또는 url)으로 반환된다
  for (const img of images) {
    const bytes = Buffer.from(img.data, 'base64');
    form.append('image[]', new Blob([bytes], { type: img.mimeType }), `input.${ext(img.mimeType)}`);
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });

  const json = (await res.json().catch(() => null)) as {
    data?: Array<{ b64_json?: string; url?: string }>;
    error?: { code?: string; message?: string };
  } | null;

  if (!res.ok) {
    const code = json?.error?.code ?? '';
    const msg = json?.error?.message ?? '';
    // 콘텐츠 정책 위반은 안전 차단으로 처리 — 재시도해도 같은 결과이므로
    if (code === 'content_policy_violation' || /content policy|inappropriate/i.test(msg)) {
      return { image: null, mood: null, safetyBlocked: true };
    }
    throw new Error(`OpenAI images/edits ${res.status}: ${code} ${msg}`.trim());
  }

  const item = json?.data?.[0];
  let b64 = item?.b64_json ?? null;
  let mimeType = 'image/png';
  if (!b64 && item?.url) {
    // url로 반환될 경우 직접 내려받아 base64로 변환
    const imgRes = await fetch(item.url);
    if (!imgRes.ok) throw new Error(`OpenAI images/edits: 결과 다운로드 실패 ${imgRes.status}`);
    b64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');
    mimeType = imgRes.headers.get('content-type')?.split(';')[0]?.trim() || 'image/png';
  }
  if (!b64) throw new Error('OpenAI images/edits: 빈 응답');

  return {
    image: { data: b64, mimeType },
    mood: null,
    safetyBlocked: false,
  };
}
