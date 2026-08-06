import { describe, it, expect } from 'vitest';
import { buildCorePrompt, composeBrief } from '@/lib/compose';
import { coquette } from '@/config/cores/coquette';
import type { PhotoTake } from '@/lib/photoTake';

/**
 * 단계 1의 합격 기준 — 새 코케트 경로가 옛 프롬프트의 하중 제약을 모두 담는가.
 *
 * 문자열 완전 일치는 불가능하다: PhotoTake가 팔레트 표현을 바꿨고
 * (hex 3개 평면 → 색 이름 + 역할 + 비율), 구조 서술도 문장화됐다.
 * 그래서 "무엇이 반드시 프롬프트에 살아 있어야 하는가"를 목록으로 검증한다.
 * 옛 프롬프트 자체의 회귀는 tests/promptBaseline.test.ts가 따로 막는다.
 */
const PHOTO: PhotoTake = {
  palette: [
    { hex: '#efe0dc', role: 'base', ratio: 0.6, nameEn: 'milky nude' },
    { hex: '#f5c8d7', role: 'main', ratio: 0.3, nameEn: 'baby pink' },
    { hex: '#221c1c', role: 'accent', ratio: 0.1, nameEn: 'warm black' },
  ],
  motifs: [{ name: 'polka dot', material: 'painted', scale: 'standard', prominence: 3 }],
  moodKo: ['코케트'],
  moodEn: 'kawaii coquette Y2K — sweet, airy, wearable.',
  tone: { saturation: 'muted', brightness: 'light', temperature: 'warm' },
  fidelityAnchors: ['pastel polka dots'],
};

/** 옛 코케트 프롬프트가 담고 있던 하중 제약. 하나라도 빠지면 기준선이 무너진다 */
const LOAD_BEARING: Array<[string, RegExp]> = [
  ['시어 밀키 누드 베이스', /sheer milky nude/i],
  ['유리광 젤 마감', /high-gloss gel|glass-like/i],
  ['딥프렌치 구조', /deep french/i],
  ['디자인은 팁 영역 안에만', /only inside/i],
  ['누드 영역은 비워둠', /left empty|stays empty/i],
  ['길이별 디자인 영역 수치', /30-45%/],
  ['여백률 명시', /Negative space: 55-70%/],
  ['금속 파츠는 납작하게', /FLAT embossed metal stud/],
  ['파츠는 클리어 젤로 봉함', /sealed under a layer of clear gel/],
  ['파츠 예산 수치', /3-6 small studs/],
  // STYLE_ANALYSIS C절 역할 문법. 영어 anchor는 ⚓를 그리므로 코어는 focal tip이라 쓴다
  ['포컬·리듬·쉼표 세트 문법', /focal tip.*rhythm.*bare nude/is],
  ['재질 에코 (같은 모티프 다른 재질)', /returns in different materials/i],
  ['스마일라인 기본 경계', /smile line/i],
  ['손으로 만든 미세 편차', /micro-variations between tips/i],
  ['매달리는 파츠 배제', /hang, dangle, or swing/i],
  ['손톱 곡률보다 높은 파츠 배제', /taller than the nail curve/i],
  ['마블 배제', /marble veining/i],
  ['매트 배제', /matte finish/i],
  ['네온·비비드 배제', /neon or vivid/i],
  ['눈·얼굴 모티프 배제', /no eyes, eyeballs/i],
  ['팁만 피사체', /tips are the only subject/i],
  ['플랫레이 회색 배경', /plain light-grey background/i],
];

describe('코케트 등가성 — 새 경로가 옛 헌법을 모두 담는가', () => {
  const prompt = buildCorePrompt(
    composeBrief(coquette, PHOTO, { shape: 'almond', length: 'medium', partsIntensity: 'auto' }),
  );

  for (const [label, pattern] of LOAD_BEARING) {
    it(`하중 제약 유지: ${label}`, () => {
      expect(prompt, prompt).toMatch(pattern);
    });
  }

  it('사진 팔레트가 색 이름과 비율로 들어간다', () => {
    expect(prompt).toContain('milky nude (#efe0dc, 60%');
  });

  it('금지 어휘가 없다', () => {
    expect(prompt).not.toMatch(/\bcharms?\b|\banchors?\b/i);
  });

  it('한글이 섞이지 않는다 (moodEn만 영어로 들어감)', () => {
    expect(prompt).not.toMatch(/[가-힣]/);
  });
});
