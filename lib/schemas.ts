import { z } from 'zod';
import { LENGTHS, MAX_IMAGE_BASE64_CHARS, SHAPES } from './request';
import type { NailLength, NailShape, PartsIntensity } from './types';

/**
 * API 요청 바디 zod 스키마 — 손으로 짠 validateBody/parseImages 계열을 대체한다.
 *
 * 책임 분리: 여기는 "HTTP 경계에서의 형태 검증"만 한다. 도메인 파서
 * (parseBrief·parseVariantPlan)는 모델 출력물 구조 검증이 본업이므로 그대로 둔다.
 * enum 값의 원본은 lib/request.ts의 SHAPES/LENGTHS — 여기서 재정의하지 않는다.
 */

const SHAPE_TUPLE = SHAPES as unknown as readonly [NailShape, ...NailShape[]];
const LENGTH_TUPLE = LENGTHS as unknown as readonly [NailLength, ...NailLength[]];
const PARTS_INTENSITY_TUPLE = ['auto', 'none', 'point', 'rich'] as readonly [
  PartsIntensity,
  ...PartsIntensity[],
];

/** base64 이미지 1장 (data URL 접두사 없음) */
export const ImagePayloadSchema = z.object({
  data: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS),
  mimeType: z.string().startsWith('image/'),
});

/** POST /api/analyze */
export const AnalyzeBodySchema = z.object({
  images: z.array(ImagePayloadSchema).min(1).max(3),
  shape: z.enum(SHAPE_TUPLE),
  length: z.enum(LENGTH_TUPLE),
  partsIntensity: z.enum(PARTS_INTENSITY_TUPLE),
});
export type AnalyzeBody = z.infer<typeof AnalyzeBodySchema>;

/** POST /api/variant — brief/plan은 도메인 파서가 검증하므로 형태·토큰만 본다 */
export const VariantBodySchema = z.object({
  images: z.array(ImagePayloadSchema).min(1).max(3),
  brief: z.unknown(),
  plan: z.unknown(),
  variantToken: z.string().min(1),
});
export type VariantBody = z.infer<typeof VariantBodySchema>;

/** POST /api/hero */
const TipSetSchema = z.object({
  image: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS * 2),
  mimeType: z.string().startsWith('image/'),
});

export const HeroBodySchema = z.object({
  images: z.array(ImagePayloadSchema).min(1).max(3),
  tipSet: TipSetSchema,
  shape: z.enum(SHAPE_TUPLE),
  length: z.enum(LENGTH_TUPLE),
});
export type HeroBody = z.infer<typeof HeroBodySchema>;

/** 저장소 부풀리기 방지 — 클라이언트 JSON 필드 크기 상한 */
const cappedJson = (maxChars: number) =>
  z.unknown().refine((v) => v == null || JSON.stringify(v).length <= maxChars);

/** POST /api/designs */
export const DesignSaveBodySchema = z.object({
  image: z.string().min(1).max(MAX_IMAGE_BASE64_CHARS * 2),
  mimeType: z.string().startsWith('image/'),
  title: z.string().min(1),
  note: z.string().optional(),
  shape: z.string().optional(),
  length: z.string().optional(),
  quality: cappedJson(8192).optional(),
  mood: cappedJson(8192).optional(),
});
export type DesignSaveBody = z.infer<typeof DesignSaveBodySchema>;
