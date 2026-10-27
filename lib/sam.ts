import { decodeMaskToRaster, parseImageStream, recordsOfKind } from '@meta-sam/parser';
import type { ImagePayload } from './types';

/**
 * Meta SAM 3.1 — 사진에서 "fingernail" 같은 명사 하나에 해당하는 영역을 픽셀 단위로 찾는다.
 * Responses API(stream) 응답은 특수 토큰 텍스트라 공식 파서(@meta-sam/parser)로 해독한다.
 * 문서: https://dev.meta.ai/docs/sam/reading-segmentation
 */

export interface Segment {
  /** 원본 픽셀 좌표, right·bottom은 미포함(half-open) */
  box: { left: number; top: number; right: number; bottom: number };
  /** 박스 크기의 0/1 래스터 (행 우선, 길이 = mask.width × mask.height) */
  raster: Uint8Array;
  maskWidth: number;
  maskHeight: number;
}

/** SSE 본문을 { type, delta } 이벤트로 바꿔 파서에 먹인다 */
async function* sseEvents(body: ReadableStream<Uint8Array>) {
  const decoder = new TextDecoder();
  let buf = '';
  for await (const chunk of body as unknown as AsyncIterable<Uint8Array>) {
    buf += decoder.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line.startsWith('data: ') && line !== 'data: [DONE]') yield JSON.parse(line.slice(6)) as { type: string };
    }
  }
}

export async function segment(image: ImagePayload, concept: string): Promise<Segment[]> {
  const res = await fetch('https://api.meta.ai/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.MODEL_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify({
      model: 'sam-3.1',
      stream: true,
      input: [{
        type: 'message',
        role: 'user',
        content: [
          { type: 'input_text', text: concept },
          { type: 'input_image', image_url: `data:${image.mimeType};base64,${image.data}` },
        ],
      }],
    }),
  });
  if (!res.ok || !res.body) throw new Error(`SAM ${res.status}: ${(await res.text()).slice(0, 300)}`);

  const result = await parseImageStream(sseEvents(res.body)).finalResult;
  const boxes = new Map(recordsOfKind(result.records, 'box').map((b) => [b.objectId, b]));
  return recordsOfKind(result.records, 'mask').flatMap((m) => {
    const b = boxes.get(m.objectId);
    if (!b) return [];
    return [{
      box: { left: b.left, top: b.top, right: b.right, bottom: b.bottom },
      raster: decodeMaskToRaster(m.mask),
      maskWidth: m.mask.width,
      maskHeight: m.mask.height,
    }];
  });
}

/** 여러 조각을 원본 크기 한 장의 0/255 마스크(1채널)로 합친다 — sharp raw 입력용 */
export function mergeMasks(segments: Segment[], width: number, height: number): Uint8Array {
  const out = new Uint8Array(width * height);
  for (const s of segments) {
    for (let y = 0; y < s.maskHeight; y++) {
      const fy = s.box.top + y;
      if (fy < 0 || fy >= height) continue;
      for (let x = 0; x < s.maskWidth; x++) {
        const fx = s.box.left + x;
        if (fx >= 0 && fx < width && s.raster[y * s.maskWidth + x]) out[fy * width + fx] = 255;
      }
    }
  }
  return out;
}
