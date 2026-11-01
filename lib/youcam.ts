import sharp from 'sharp';
import type { ImagePayload } from './types';

/**
 * YouCam API (Perfect Corp) 최소 클라이언트 — 파일 업로드 → 작업 생성 → 상태 확인.
 * 문서: https://docs.perfectcorp.com/reference/ai_nail_transfer
 * 모든 AI 작업이 같은 비동기 패턴이라 runTask 하나로 nail·skin-tone 등을 다 부른다.
 */

const BASE = 'https://yce-api-01.makeupar.com/s2s/v2.0';

export class YouCamError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

function key(): string {
  const k = process.env.YOUCAM_API_KEY;
  if (!k) throw new YouCamError('NO_KEY', 'YOUCAM_API_KEY 없음');
  return k;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, 'Content-Type': 'application/json', ...init?.headers },
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string; error_code?: string; data?: unknown };
  if (!res.ok) throw new YouCamError(json.error_code ?? `HTTP_${res.status}`, json.error);
  return json.data as T;
}

type FileData = { files: { file_id: string; requests: { url: string; method: string; headers: Record<string, string> }[] }[] };

/** 이미지를 YouCam 저장소에 올리고 file_id를 받는다 */
export async function uploadImage(img: ImagePayload, name = 'image'): Promise<string> {
  // YouCam은 jpg/png·긴 변 4096 이하만 받는다 — Muse 결과는 webp라 항상 JPEG로 통일
  const buf = await sharp(Buffer.from(img.data, 'base64'))
    .rotate()
    .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 92 })
    .toBuffer();
  const { files } = await call<FileData>('/file', {
    method: 'POST',
    body: JSON.stringify({ files: [{ content_type: 'image/jpg', file_name: `${name}.jpg`, file_size: buf.length }] }),
  });
  const f = files[0];
  const up = f.requests[0];
  const res = await fetch(up.url, { method: up.method || 'PUT', headers: up.headers, body: buf });
  if (!res.ok) throw new YouCamError('UPLOAD_FAILED', `HTTP_${res.status}`);
  return f.file_id;
}

type TaskStatus = { task_status: 'running' | 'success' | 'error'; error?: string | null; error_message?: string; results?: unknown };

/** 작업 생성 후 끝날 때까지 기다려 results를 돌려준다. task = 'ai-nail', 'skin-tone-analysis' 등 */
export async function runTask<R>(task: string, body: Record<string, unknown>, timeoutMs = 50_000): Promise<R> {
  const { task_id } = await call<{ task_id: string }>(`/task/${task}`, { method: 'POST', body: JSON.stringify(body) });
  const deadline = Date.now() + timeoutMs;
  // 문서는 10초 간격을 권하지만 Vercel 60초 제한 안에 끝내야 해서 2초 간격
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await call<TaskStatus>(`/task/${task}/${encodeURIComponent(task_id)}`);
    if (s.task_status === 'success') return s.results as R;
    if (s.task_status === 'error') throw new YouCamError(s.error ?? 'TASK_ERROR', s.error_message);
  }
  throw new YouCamError('TIMEOUT');
}

/** 결과 URL(2시간 유효)을 받아 base64로 — 우리 쪽에 저장해야 링크가 안 죽는다 */
export async function fetchImage(url: string): Promise<ImagePayload> {
  const res = await fetch(url);
  if (!res.ok) throw new YouCamError('RESULT_DOWNLOAD_FAILED', `HTTP_${res.status}`);
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  return { data: Buffer.from(await res.arrayBuffer()).toString('base64'), mimeType };
}
