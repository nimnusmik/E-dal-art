import { describe, it, expect } from 'vitest';
import { selectMotifs } from '@/lib/compose';
import { coquette } from '@/config/cores/coquette';
import type { PhotoMotif } from '@/lib/photoTake';

const dot: PhotoMotif = { name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 };
const pearl: PhotoMotif = { name: 'small pearl', material: 'pearl', scale: 'micro', prominence: 2 };
const lily: PhotoMotif = { name: 'sculpted lily', material: 'sculpted', scale: 'big', prominence: 3 };
const chromeSwirl: PhotoMotif = { name: 'chrome swirl', material: 'chrome', scale: 'standard', prominence: 1 };

import { composeBrief, buildCorePrompt } from '@/lib/compose';
import { UNIVERSAL_RULES } from '@/lib/core';
import type { PhotoTake } from '@/lib/photoTake';

const PHOTO: PhotoTake = {
  palette: [
    { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
    { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
    { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
  ],
  motifs: [dot, pearl],
  moodKo: ['코케트'],
  moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
  tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
  fidelityAnchors: ['pastel polka dots'],
};

const OPTS = { shape: 'almond' as const, length: 'medium' as const, partsIntensity: 'auto' as const };

describe('composeBrief', () => {
  it('사용자 주문 쉐입·길이를 담는다', () => {
    const brief = composeBrief(coquette, PHOTO, OPTS);
    expect(brief.shape).toBe('almond');
    expect(brief.length).toBe('medium');
  });

  it('재질 보존 규칙을 통과한 모티프만 담는다', () => {
    const brief = composeBrief(coquette, { ...PHOTO, motifs: [lily, dot] }, OPTS);
    expect(brief.motifs).toEqual([dot]);
  });

  it('partsIntensity=none이면 파츠 재질 모티프가 빠진다', () => {
    const brief = composeBrief(coquette, PHOTO, { ...OPTS, partsIntensity: 'none' });
    expect(brief.motifs.some((m) => m.material === 'pearl')).toBe(false);
    expect(brief.motifs.some((m) => m.material === 'painted')).toBe(true);
  });
});

describe('buildCorePrompt — 조립 순서 (D5: 코어 우선)', () => {
  const prompt = buildCorePrompt(composeBrief(coquette, PHOTO, OPTS));

  it('코어 구조가 사진 팔레트보다 먼저 나온다', () => {
    const baseAt = prompt.indexOf('Base of every tip');
    const paletteAt = prompt.indexOf('Palette:');
    expect(baseAt).toBeGreaterThan(-1);
    expect(paletteAt).toBeGreaterThan(-1);
    expect(baseAt).toBeLessThan(paletteAt);
  });

  it('코어 시그니처가 사진 모티프보다 먼저 나온다', () => {
    // indexOf는 대소문자를 구분한다. 못 찾으면 -1이 되어 비교가 무조건 통과하므로
    // 먼저 존재를 확인한 뒤 순서를 본다
    const sigAt = prompt.indexOf('design lives only inside');
    const motifAt = prompt.indexOf('Motifs to use');
    expect(sigAt).toBeGreaterThan(-1);
    expect(motifAt).toBeGreaterThan(-1);
    expect(sigAt).toBeLessThan(motifAt);
  });

  it('팔레트를 색 이름·역할·비율로 서술한다', () => {
    expect(prompt).toContain('milky nude');
    expect(prompt).toContain('60%');
    expect(prompt).toMatch(/ground colour|base/i);
  });

  it('모티프를 이름·재질·스케일로 서술한다', () => {
    expect(prompt).toContain('polka dot');
    expect(prompt).toContain('painted');
    expect(prompt).toContain('standard');
  });

  it('코어의 길이별 디자인 영역 규칙을 넣는다', () => {
    expect(prompt).toContain('30-45%');
  });

  it('코어 파츠 물리와 금지 항목을 넣는다', () => {
    expect(prompt).toContain('METAL PART PHYSICS');
    expect(prompt).toContain('marble veining');
  });

  it('공통분모 4줄을 모두 넣는다', () => {
    for (const rule of UNIVERSAL_RULES) expect(prompt).toContain(rule);
  });

  it('금지 어휘 charm·anchor를 쓰지 않는다', () => {
    expect(prompt).not.toMatch(/\bcharms?\b|\banchors?\b/i);
  });

  it('텍스처가 없는 코어는 질감 줄을 넣지 않는다', () => {
    expect(prompt).not.toContain('TEXTURE:');
  });

  it('레터링이 있으면 한 팁에 한 번만 쓰라고 지시한다', () => {
    const withLettering = buildCorePrompt({
      ...composeBrief(coquette, PHOTO, OPTS),
      letteringWord: 'Sugar',
    });
    expect(withLettering).toContain('"Sugar"');
    expect(withLettering).toContain('on one tip only');
  });

  it('빈 줄이 3줄 이상 연속되지 않는다', () => {
    expect(prompt).not.toMatch(/\n{3,}/);
  });
});

describe('selectMotifs — 재질 보존 규칙 (D7)', () => {
  it('허용 재질 모티프는 재질을 바꾸지 않고 그대로 통과시킨다', () => {
    const picked = selectMotifs(coquette, [dot, pearl]);
    expect(picked).toEqual([dot, pearl]);
  });

  it('허용되지 않은 재질은 변환하지 않고 제외한다', () => {
    // coquette.allowedMaterials = ['painted','metal','pearl'] — sculpted·chrome 없음
    const picked = selectMotifs(coquette, [lily, dot, chromeSwirl]);
    expect(picked).toEqual([dot]);
    expect(picked.some((m) => m.material === 'sculpted')).toBe(false);
  });

  it('제외된 자리는 다음 prominence 모티프가 채운다', () => {
    const core = { ...coquette, motifBudget: 2 };
    const low: PhotoMotif = { name: 'thin stripe', material: 'painted', scale: 'micro', prominence: 1 };
    const picked = selectMotifs(core, [lily, dot, low]);
    expect(picked).toEqual([dot, low]);
  });

  it('motifBudget을 넘으면 prominence 높은 순으로 자른다', () => {
    const core = { ...coquette, motifBudget: 1 };
    expect(selectMotifs(core, [pearl, dot])).toEqual([dot]);
  });

  it('모티프가 없으면 빈 배열 (원톤 사진)', () => {
    expect(selectMotifs(coquette, [])).toEqual([]);
  });

  it('허용 재질이 하나도 없으면 빈 배열 — 억지로 채우지 않는다', () => {
    expect(selectMotifs(coquette, [lily, chromeSwirl])).toEqual([]);
  });
});
