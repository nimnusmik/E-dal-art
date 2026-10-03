import { describe, it, expect } from 'vitest';
import {
  AnalyzeBodySchema,
  DesignSaveBodySchema,
  HeroBodySchema,
  VariantBodySchema,
} from '@/lib/schemas';

const IMG = { data: 'aGVsbG8=', mimeType: 'image/jpeg' };
const ANALYZE_OK = { images: [IMG], shape: 'almond', length: 'medium', partsIntensity: 'auto' };

describe('AnalyzeBodySchema', () => {
  it('정상 바디 통과', () => {
    expect(AnalyzeBodySchema.safeParse(ANALYZE_OK).success).toBe(true);
  });

  it('사진 0장·4장 거부', () => {
    expect(AnalyzeBodySchema.safeParse({ ...ANALYZE_OK, images: [] }).success).toBe(false);
    expect(
      AnalyzeBodySchema.safeParse({ ...ANALYZE_OK, images: [IMG, IMG, IMG, IMG] }).success,
    ).toBe(false);
  });

  it('잘못된 shape/length/partsIntensity 거부', () => {
    expect(AnalyzeBodySchema.safeParse({ ...ANALYZE_OK, shape: 'octagon' }).success).toBe(false);
    expect(AnalyzeBodySchema.safeParse({ ...ANALYZE_OK, length: 'huge' }).success).toBe(false);
    expect(AnalyzeBodySchema.safeParse({ ...ANALYZE_OK, partsIntensity: 'max' }).success).toBe(false);
  });

  it('mimeType이 이미지가 아니면 거부', () => {
    const bad = { ...ANALYZE_OK, images: [{ ...IMG, mimeType: 'text/plain' }] };
    expect(AnalyzeBodySchema.safeParse(bad).success).toBe(false);
  });

  it('빈 data 거부', () => {
    const bad = { ...ANALYZE_OK, images: [{ ...IMG, data: '' }] };
    expect(AnalyzeBodySchema.safeParse(bad).success).toBe(false);
  });
});

describe('VariantBodySchema', () => {
  const OK = { images: [IMG], brief: {}, plan: {}, variantToken: 'tok' };

  it('정상 바디 통과 (brief/plan 내용은 도메인 파서가 검증)', () => {
    expect(VariantBodySchema.safeParse(OK).success).toBe(true);
  });

  it('variantToken 없으면 거부', () => {
    const { variantToken: _omit, ...rest } = OK;
    expect(VariantBodySchema.safeParse(rest).success).toBe(false);
  });
});

describe('HeroBodySchema', () => {
  const OK = {
    images: [IMG],
    tipSet: { image: 'dGlwc2V0', mimeType: 'image/png' },
    shape: 'almond',
    length: 'short',
  };

  it('정상 바디 통과', () => {
    expect(HeroBodySchema.safeParse(OK).success).toBe(true);
  });

  it('tipSet 없으면 거부', () => {
    const { tipSet: _omit, ...rest } = OK;
    expect(HeroBodySchema.safeParse(rest).success).toBe(false);
  });
});

describe('DesignSaveBodySchema', () => {
  const OK = { image: 'aGVsbG8=', mimeType: 'image/png', title: '봄 시안' };

  it('정상 바디 통과', () => {
    expect(DesignSaveBodySchema.safeParse(OK).success).toBe(true);
  });

  it('빈 title 거부', () => {
    expect(DesignSaveBodySchema.safeParse({ ...OK, title: '' }).success).toBe(false);
  });

  it('8KB 넘는 quality/mood 거부 (저장소 부풀리기 방지)', () => {
    const big = { x: 'y'.repeat(9000) };
    expect(DesignSaveBodySchema.safeParse({ ...OK, quality: big }).success).toBe(false);
    expect(DesignSaveBodySchema.safeParse({ ...OK, mood: big }).success).toBe(false);
    expect(DesignSaveBodySchema.safeParse({ ...OK, quality: { pass: true } }).success).toBe(true);
  });
});
