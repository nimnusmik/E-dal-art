import { describe, it, expect } from 'vitest';
import { parsePhotoTake, extractPhotoTake } from '@/lib/photoTake';

const VALID = {
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
  fidelityAnchors: ['pastel polka dots inside the tip zone', 'milky nude negative space'],
};

describe('parsePhotoTake', () => {
  it('올바른 JSON을 파싱한다', () => {
    const take = parsePhotoTake(JSON.stringify(VALID));
    expect(take?.palette).toHaveLength(3);
    expect(take?.motifs[0].name).toBe('polka dot');
    expect(take?.tone.saturation).toBe('muted');
  });

  it('JSON이 아니면 null', () => {
    expect(parsePhotoTake('not json')).toBeNull();
  });

  it('팔레트가 비면 null', () => {
    expect(parsePhotoTake(JSON.stringify({ ...VALID, palette: [] }))).toBeNull();
  });

  it('role이 규정 외면 null', () => {
    const bad = { ...VALID, palette: [{ ...VALID.palette[0], role: 'highlight' }] };
    expect(parsePhotoTake(JSON.stringify(bad))).toBeNull();
  });

  it('material이 규정 외면 null', () => {
    const bad = { ...VALID, motifs: [{ ...VALID.motifs[0], material: 'plastic' }] };
    expect(parsePhotoTake(JSON.stringify(bad))).toBeNull();
  });

  it('hex 형식이 아니면 null', () => {
    const bad = { ...VALID, palette: [{ ...VALID.palette[0], hex: 'pink' }] };
    expect(parsePhotoTake(JSON.stringify(bad))).toBeNull();
  });

  it('모티프가 0개인 사진(원톤)은 허용한다', () => {
    const take = parsePhotoTake(JSON.stringify({ ...VALID, motifs: [] }));
    expect(take?.motifs).toEqual([]);
  });

  it('모티프 8개 초과는 prominence 높은 순 8개로 자른다', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      name: `motif ${i}`,
      material: 'painted',
      scale: 'standard',
      prominence: ((i % 3) + 1) as 1 | 2 | 3,
    }));
    const take = parsePhotoTake(JSON.stringify({ ...VALID, motifs: many }));
    expect(take?.motifs).toHaveLength(8);
    expect(take?.motifs[0].prominence).toBe(3);
  });

  it('ratio 합계가 1이 아니면 1로 정규화한다', () => {
    const bad = {
      ...VALID,
      palette: VALID.palette.map((p) => ({ ...p, ratio: 1 })),
    };
    const take = parsePhotoTake(JSON.stringify(bad));
    const sum = take!.palette.reduce((s, p) => s + p.ratio, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

describe('extractPhotoTake (mock)', () => {
  it('GEMINI_MOCK=1이면 목 결과를 반환한다', async () => {
    process.env.GEMINI_MOCK = '1';
    const take = await extractPhotoTake([]);
    expect(take?.palette.length).toBeGreaterThan(0);
    expect(take?.palette.some((p) => p.role === 'base')).toBe(true);
    delete process.env.GEMINI_MOCK;
  });

  it('목 결과의 ratio 합계는 1', async () => {
    process.env.GEMINI_MOCK = '1';
    const take = await extractPhotoTake([]);
    const sum = take!.palette.reduce((s, p) => s + p.ratio, 0);
    expect(sum).toBeCloseTo(1, 5);
    delete process.env.GEMINI_MOCK;
  });
});
