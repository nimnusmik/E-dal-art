import { describe, expect, it } from 'vitest';
import { Type } from '@google/genai';
import { toJsonSchema, toMuseBody } from '@/lib/geminiText';

describe('Muse 번역', () => {
  it('Gemini 스키마 type을 JSON Schema 소문자로 바꾼다 (중첩·배열 포함)', () => {
    const s = { type: Type.OBJECT, properties: { a: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ['a'] };
    expect(toJsonSchema(s)).toEqual({
      type: 'object',
      properties: { a: { type: 'array', items: { type: 'string' } } },
      required: ['a'],
    });
  });

  it('inlineData는 data URL 이미지로, 순서 유지, 스키마 있으면 json_schema', () => {
    const body = toMuseBody(
      {
        contents: [{ inlineData: { data: 'AAA', mimeType: 'image/png' } }, { text: 'hi' }],
        config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT } },
      },
      'muse-spark-1.3',
    );
    expect(body.messages[0].content).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/png;base64,AAA' } },
      { type: 'text', text: 'hi' },
    ]);
    expect(body.response_format?.json_schema.schema).toEqual({ type: 'object' });
  });
});

describe('sniffMime', () => {
  it('파일 앞부분으로 webp·jpeg·png를 구분한다', async () => {
    const { sniffMime } = await import('@/lib/museimage');
    const b64 = (bytes: number[] | string) => Buffer.from(typeof bytes === 'string' ? bytes : Uint8Array.from(bytes)).toString('base64');
    expect(sniffMime(b64('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp');
    expect(sniffMime(b64([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    expect(sniffMime(b64([0x89, 0x50, 0x4e, 0x47]))).toBe('image/png');
  });
});

describe('noDash', () => {
  it('대시를 쉼표로 바꾸고 양끝 쉼표는 지운다', async () => {
    const { noDash } = await import('@/lib/brief');
    expect(noDash('Bold wings — quiet base')).toBe('Bold wings, quiet base');
    expect(noDash('A – B')).toBe('A, B');
    expect(noDash('— lead')).toBe('lead');
    expect(noDash('no dash')).toBe('no dash');
  });
});
