import { GoogleGenAI, Type } from '@google/genai';
import type { Material } from './core';
import type { ImagePayload } from './types';

/**
 * 📷 사진에서만 뽑는 것 — 팔레트·모티프·무드 (스펙 4절 소유권 분리).
 * 구조·질감·파츠는 코어가 소유하므로 여기에 없다.
 */

export type Scale = 'micro' | 'standard' | 'big';
export type Prominence = 1 | 2 | 3;

export interface PhotoMotif {
  /** 'polka dot' | 'leopard print' | 'baroque relief' — 구조 서술 없이 모티프 이름만 */
  name: string;
  material: Material;
  scale: Scale;
  /** 사진에서의 지배력. 코어 예산 배분 순위로 쓰인다 */
  prominence: Prominence;
}

export interface PaletteEntry {
  hex: string;
  role: 'base' | 'main' | 'accent';
  /** 0~1, 합계 1.0 */
  ratio: number;
  /** 'baby pink' — 모델은 색 이름을 hex보다 잘 이해한다 */
  nameEn: string;
}

export interface PhotoTake {
  palette: PaletteEntry[];
  /** 상한 8개. 사진에 있는 만큼 뽑고 prominence로 순위를 매긴다 */
  motifs: PhotoMotif[];
  moodKo: string[];
  moodEn: string;
  tone: {
    saturation: 'muted' | 'medium' | 'vivid';
    brightness: 'dark' | 'mid' | 'light';
    temperature: 'cool' | 'neutral' | 'warm';
  };
  /** "반드시 살아야 함" 2~3개 — judge 충실도 채점용 */
  fidelityAnchors: string[];
}

const MATERIALS = new Set<string>([
  'painted', 'gel-volume', 'metal', 'pearl', 'chrome', 'sculpted',
]);
const ROLES = new Set(['base', 'main', 'accent']);
const SCALES = new Set(['micro', 'standard', 'big']);
const SATURATIONS = new Set(['muted', 'medium', 'vivid']);
const BRIGHTNESSES = new Set(['dark', 'mid', 'light']);
const TEMPERATURES = new Set(['cool', 'neutral', 'warm']);

const MOTIF_LIMIT = 8;

/** JSON 텍스트 → PhotoTake. 스키마 위반 시 null (호출부가 폴백) */
export function parsePhotoTake(text: string): PhotoTake | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const t = parsed as Record<string, unknown>;

  const palette = parsePalette(t.palette);
  if (!palette) return null;

  const motifs = parseMotifs(t.motifs);
  if (!motifs) return null;

  if (!isStrArr(t.moodKo) || t.moodKo.length === 0) return null;
  if (typeof t.moodEn !== 'string' || t.moodEn.length === 0) return null;
  if (!isStrArr(t.fidelityAnchors)) return null;

  const tone = t.tone;
  if (typeof tone !== 'object' || tone === null) return null;
  const to = tone as Record<string, unknown>;
  if (typeof to.saturation !== 'string' || !SATURATIONS.has(to.saturation)) return null;
  if (typeof to.brightness !== 'string' || !BRIGHTNESSES.has(to.brightness)) return null;
  if (typeof to.temperature !== 'string' || !TEMPERATURES.has(to.temperature)) return null;

  return {
    palette,
    motifs,
    moodKo: t.moodKo,
    moodEn: t.moodEn,
    tone: {
      saturation: to.saturation as PhotoTake['tone']['saturation'],
      brightness: to.brightness as PhotoTake['tone']['brightness'],
      temperature: to.temperature as PhotoTake['tone']['temperature'],
    },
    fidelityAnchors: t.fidelityAnchors,
  };
}

function isStrArr(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

function parsePalette(value: unknown): PaletteEntry[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const entries: PaletteEntry[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return null;
    const p = raw as Record<string, unknown>;
    if (typeof p.hex !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(p.hex)) return null;
    if (typeof p.role !== 'string' || !ROLES.has(p.role)) return null;
    if (typeof p.nameEn !== 'string' || p.nameEn.length === 0) return null;
    if (typeof p.ratio !== 'number' || !Number.isFinite(p.ratio) || p.ratio <= 0) return null;
    entries.push({
      hex: p.hex.toLowerCase(),
      role: p.role as PaletteEntry['role'],
      ratio: p.ratio,
      nameEn: p.nameEn,
    });
  }
  // 모델이 비율을 못 맞추므로 합계 1.0으로 정규화한다
  const sum = entries.reduce((s, e) => s + e.ratio, 0);
  return entries.map((e) => ({ ...e, ratio: e.ratio / sum }));
}

function parseMotifs(value: unknown): PhotoMotif[] | null {
  if (!Array.isArray(value)) return null;
  const motifs: PhotoMotif[] = [];
  for (const raw of value) {
    if (typeof raw !== 'object' || raw === null) return null;
    const m = raw as Record<string, unknown>;
    if (typeof m.name !== 'string' || m.name.length === 0) return null;
    if (typeof m.material !== 'string' || !MATERIALS.has(m.material)) return null;
    if (typeof m.scale !== 'string' || !SCALES.has(m.scale)) return null;
    if (m.prominence !== 1 && m.prominence !== 2 && m.prominence !== 3) return null;
    motifs.push({
      name: m.name,
      material: m.material as Material,
      scale: m.scale as Scale,
      prominence: m.prominence,
    });
  }
  // 상한 초과는 지배력 높은 순으로 자른다 (사진 정보를 버리는 유일한 지점)
  return [...motifs].sort((a, b) => b.prominence - a.prominence).slice(0, MOTIF_LIMIT);
}

/** 사진 → PhotoTake. 일시 오류 대비 1회 재시도, 최종 실패 시 null */
export async function extractPhotoTake(images: ImagePayload[]): Promise<PhotoTake | null> {
  const first = await extractOnce(images);
  if (first) return first;
  await new Promise((r) => setTimeout(r, 2000));
  return extractOnce(images);
}

async function extractOnce(images: ImagePayload[]): Promise<PhotoTake | null> {
  if (process.env.GEMINI_MOCK === '1') return mockPhotoTake();
  try {
    const model = process.env.GEMINI_ANALYZE_MODEL ?? 'gemini-3.5-flash';
    const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await client.models.generateContent({
      model,
      contents: [
        ...images.map((img) => ({ inlineData: { data: img.data, mimeType: img.mimeType } })),
        { text: EXTRACT_INSTRUCTION },
      ],
      config: { responseMimeType: 'application/json', responseSchema: PHOTO_TAKE_SCHEMA },
    });
    return parsePhotoTake(response.text ?? '');
  } catch {
    return null;
  }
}

const EXTRACT_INSTRUCTION = `You are a veteran Korean nail artist reading inspiration photos a client brought in.
Extract ONLY three things: the colour palette, the motif vocabulary, and the mood.
Do NOT describe layout, structure, french depth, negative space, or where things sit on the nail — a separate style system owns all of that. Describing placement will corrupt the pipeline.

## palette
List 3-5 colours. For each: hex, a plain English colour name, its role, and how much of the surface it covers.
- role "base" = the ground colour the nail starts from
- role "main" = the colours the design is drawn in
- role "accent" = small-quantity colours used for lines, dots, or metal
- ratio: your estimate of surface share, all ratios summing to about 1.0

## motifs
List every distinct motif you can see, up to 8. For each:
- name: the motif itself as a noun phrase ("polka dot", "leopard print", "baroque relief", "cable knit", "hand-painted rose"). No placement words.
- material: how it is physically made — "painted" (brush on gel), "gel-volume" (raised clear or tinted gel), "metal" (cast stud or bead), "pearl" (domed pearl), "chrome" (mirror powder), "sculpted" (hand-shaped 3D gel or acrylic form)
- scale: micro (under 1mm) / standard / big (3mm+)
- prominence: 3 = dominates the photo, 2 = clearly present, 1 = minor detail
If the photo is a plain one-tone manicure with no motifs, return an empty array.

## mood
- moodKo: 2-3 short Korean mood words
- moodEn: one short English mood sentence
- tone: overall saturation, brightness, and colour temperature
- fidelityAnchors: 2-3 short English phrases naming what MUST survive for the client to recognise their photo`;

const PHOTO_TAKE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    palette: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          hex: { type: Type.STRING },
          nameEn: { type: Type.STRING },
          role: { type: Type.STRING, enum: ['base', 'main', 'accent'] },
          ratio: { type: Type.NUMBER },
        },
        required: ['hex', 'nameEn', 'role', 'ratio'],
      },
    },
    motifs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          material: {
            type: Type.STRING,
            enum: ['painted', 'gel-volume', 'metal', 'pearl', 'chrome', 'sculpted'],
          },
          scale: { type: Type.STRING, enum: ['micro', 'standard', 'big'] },
          prominence: { type: Type.INTEGER },
        },
        required: ['name', 'material', 'scale', 'prominence'],
      },
    },
    moodKo: { type: Type.ARRAY, items: { type: Type.STRING } },
    moodEn: { type: Type.STRING },
    tone: {
      type: Type.OBJECT,
      properties: {
        saturation: { type: Type.STRING, enum: ['muted', 'medium', 'vivid'] },
        brightness: { type: Type.STRING, enum: ['dark', 'mid', 'light'] },
        temperature: { type: Type.STRING, enum: ['cool', 'neutral', 'warm'] },
      },
      required: ['saturation', 'brightness', 'temperature'],
    },
    fidelityAnchors: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['palette', 'motifs', 'moodKo', 'moodEn', 'tone', 'fidelityAnchors'],
};

/** 로컬 개발용 목 (GEMINI_MOCK=1) — 실제 호출·과금 없이 전체 흐름 확인 */
async function mockPhotoTake(): Promise<PhotoTake> {
  await new Promise((r) => setTimeout(r, 300));
  return {
    palette: [
      { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
      { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
      { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
    ],
    motifs: [
      { name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 },
      { name: 'small pearl', material: 'pearl', scale: 'micro', prominence: 1 },
    ],
    moodKo: ['코케트', '파스텔'],
    moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
    tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
    fidelityAnchors: ['pastel polka dots', 'milky nude ground'],
  };
}
