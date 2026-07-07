import { describe, it, expect } from 'vitest';
import { fitWithin } from '@/lib/resize';

describe('fitWithin', () => {
  it('가로가 긴 사진: 긴 변을 max로 축소', () => {
    expect(fitWithin(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 });
  });

  it('세로가 긴 사진', () => {
    expect(fitWithin(3000, 4000, 1024)).toEqual({ width: 768, height: 1024 });
  });

  it('이미 작으면 그대로', () => {
    expect(fitWithin(800, 600, 1024)).toEqual({ width: 800, height: 600 });
  });

  it('정사각형', () => {
    expect(fitWithin(2048, 2048, 1024)).toEqual({ width: 1024, height: 1024 });
  });
});
