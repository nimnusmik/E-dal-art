import type { Material } from './core';

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
