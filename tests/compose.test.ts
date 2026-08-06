import { describe, it, expect } from 'vitest';
import { selectMotifs } from '@/lib/compose';
import { coquette } from '@/config/cores/coquette';
import type { PhotoMotif } from '@/lib/photoTake';

const dot: PhotoMotif = { name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 };
const pearl: PhotoMotif = { name: 'small pearl', material: 'pearl', scale: 'micro', prominence: 2 };
const lily: PhotoMotif = { name: 'sculpted lily', material: 'sculpted', scale: 'big', prominence: 3 };
const chromeSwirl: PhotoMotif = { name: 'chrome swirl', material: 'chrome', scale: 'standard', prominence: 1 };

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
