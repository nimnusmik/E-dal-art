import { describe, it, expect } from 'vitest';
import { parseSeedreamResponse, sniffMime, isModerationError } from '@/lib/seedream';

describe('sniffMime', () => {
  it('JPEG base64 앞머리 → image/jpeg', () => {
    expect(sniffMime('/9j/4AAQSkZJRg')).toBe('image/jpeg');
  });
  it('PNG base64 앞머리 → image/png', () => {
    expect(sniffMime('iVBORw0KGgoAAAA')).toBe('image/png');
  });
  it('알 수 없으면 image/png 기본', () => {
    expect(sniffMime('abcdef')).toBe('image/png');
  });
});

describe('parseSeedreamResponse', () => {
  it('b64_json → 이미지 반환, mood는 null', () => {
    const out = parseSeedreamResponse({ data: [{ b64_json: '/9j/abc' }] });
    expect(out.image).toEqual({ data: '/9j/abc', mimeType: 'image/jpeg' });
    expect(out.mood).toBeNull();
    expect(out.safetyBlocked).toBe(false);
  });

  it('data 없음 → image null', () => {
    expect(parseSeedreamResponse({}).image).toBeNull();
  });

  it('url만 있고 b64_json 없음 → image null (우리는 b64_json만 사용)', () => {
    expect(parseSeedreamResponse({ data: [{ url: 'https://x/y.png' }] }).image).toBeNull();
  });
});

describe('isModerationError', () => {
  it('민감 콘텐츠 관련 에러 → true', () => {
    expect(isModerationError({ error: { code: 'SensitiveContentDetected' } })).toBe(true);
    expect(isModerationError({ message: 'content policy violation' })).toBe(true);
  });
  it('일반 에러 → false', () => {
    expect(isModerationError({ error: { code: 'InternalServiceError' } })).toBe(false);
    expect(isModerationError(null)).toBe(false);
  });
});
