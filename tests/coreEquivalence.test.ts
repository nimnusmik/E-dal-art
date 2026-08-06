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
 *
 * ⚠️ LOAD_BEARING이 실제로 무엇을 증명하는지 — 아래 표는 성격이 다른 두 종류를 섞어 놓았다.
 * (1) 옛 것에서 이식된 제약: lib/brief.ts의 buildBriefPrompt / PARTS_PHYSICS /
 *     LENGTH_RULES에 실제로 있던 문장을 그대로 검증하는 항목들 (표의 대부분 —
 *     시어 밀키 누드, 유리광 젤, 딥프렌치 구조, 길이별 수치, 금속 파츠 규칙,
 *     스마일라인, 손으로 만든 편차, 매달리는 파츠 배제 등).
 * (2) 코어가 새로 추가한 규칙: 여백률 55-70%, focal·rhythm·bare nude 세트 문법,
 *     재질 에코("returns in different materials"), 마블·매트·네온·눈 모티프 배제 등
 *     약 9개는 옛 buildBriefPrompt에도, tests/__snapshots__/promptBaseline.test.ts.snap
 *     스냅샷에도 없다 — 코케트 코어가 ref/trendy/STYLE_ANALYSIS.md를 근거로 새로
 *     도입한 규칙이다. 따라서 표 전체를 "옛 프롬프트가 담고 있던 하중 제약"이라고
 *     부르는 것은 부정확하다: (1)은 회귀 방지, (2)는 "코어가 스스로 약속한 규칙이
 *     실제로 조립된 프롬프트에 들어가는가"를 검증하는 것이지, 옛 프롬프트와의
 *     등가성 증명이 아니다. 표를 항목별로 다시 라벨링하지는 않았지만, 읽는 사람은
 *     이 구분을 염두에 두어야 한다.
 *
 * ⚠️ 파츠 규칙의 의미 변화 — 검증 대상에서 의도적으로 제외됨.
 * 옛 buildBriefPrompt는 팁 단위 배제문을 썼다:
 *   "Exactly one tip carries a single small pearl on its french boundary line.
 *    Every other tip is painted gel only — no metal, no gems, no pearls."
 * 새 buildCorePrompt(auto)는 세트 전체 총량 예산으로 바꿔 썼다:
 *   "Parts budget for the whole set: 1 statement part plus 3-6 small studs or
 *    beads in total."
 * 이 둘은 형태가 다르다 — 옛 문장은 "몇 번째 팁에" 파츠가 있는지 못박고
 * 나머지 팁을 명시적으로 배제하는 팁 단위(per-tip) 서술이고, 새 문장은
 * 세트 전체에 대한 총량(set-level) 서술이다. lib/brief.ts의
 * BRIEF_INSTRUCTION 1항은 바로 이런 세트 단위 수량어("select tips",
 * "some tips" 등)를 명시적으로 금지한다 — "Never write vague quantifiers".
 * 또한 lib/core.ts의 judge.minPartsTips/maxPartsTips는 "파츠가 있는 팁의 개수"를
 * 세는 필드인데, 프롬프트는 이제 팁 개수가 아니라 파츠 총 개수를 지정하므로
 * judge 필드와 프롬프트 표현의 단위가 어긋난다.
 * 이 차이는 실수가 아니라 의도된 보류다 — 제품 책임자가 세트 단위 표현을
 * 유지하기로 결정했고, 실제 생성 이미지로 판단하기 전까지는 코드를 바꾸지
 * 않기로 했다. 그래서 이 파일은 두 형태 중 어느 쪽도 정답이라 단정하는
 * 테스트를 추가하지 않는다 — 판단을 미룬 상태를 그대로 기록만 한다.
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

/**
 * 하나라도 빠지면 기준선이 무너지는 제약 목록.
 * "전부 옛 프롬프트에서 옮겨온 것"은 아니다 — 위 docstring (2)절 참고,
 * 이 중 약 9개는 코어가 새로 도입한 규칙이다.
 */
const LOAD_BEARING: Array<[string, RegExp]> = [
  ['시어 밀키 누드 베이스', /sheer milky nude/i],
  ['유리광 젤 마감', /high-gloss gel|glass-like/i],
  ['딥프렌치 구조', /deep french/i],
  // signature[0]가 소유한 하이픈 표기 "deep-french tip zone" — compose.ts의
  // structureSentence는 이 문구를 "deep french boundary"(하이픈 없음)로만 쓰므로,
  // signature[0]을 지우면 이 정규식은 더 이상 매치되지 않는다.
  ['디자인은 딥프렌치 팁존 안에만 (signature 고유 표기)', /deep-french tip zone/i],
  // signature[0] 전체 문구를 통째로 겨냥한다 — compose.ts의 structureSentence는
  // "zone above it left empty"라고만 쓰고 이 문구는 쓰지 않으므로 signature[0]에만 산다.
  ['누드 영역은 비워둠 (signature 고유 문구)', /nude zone above the boundary stays empty and glossy/i],
  ['길이별 디자인 영역 수치', /30-45%/],
  ['여백률 명시', /Negative space: 55-70%/],
  ['금속 파츠는 납작하게', /FLAT embossed metal stud/],
  // partsPhysics 고유 문구 — lib/core.ts의 UNIVERSAL_RULES[0]도 "sealed under a
  // layer of clear gel"을 쓰지만 "lying flush ON the nail surface"는 partsPhysics에만 있다.
  ['파츠는 클리어 젤로 봉함 (partsPhysics 고유 문구)', /lying flush ON the nail surface, sealed under a layer of clear gel/],
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

import { decoden } from '@/config/cores/decoden';
import { nuance } from '@/config/cores/nuance';
import { textureGummy } from '@/config/cores/texture-gummy';

describe('코어별 프롬프트 분기 — 같은 사진에서 다른 지시가 나온다', () => {
  const opts = { shape: 'almond' as const, length: 'medium' as const, partsIntensity: 'auto' as const };
  const build = (core: typeof coquette) => buildCorePrompt(composeBrief(core, PHOTO, opts));

  it('데코덴은 여백을 0-15%로, 코케트는 55-70%로 지시한다', () => {
    expect(build(decoden)).toContain('Negative space: 0-15%');
    expect(build(coquette)).toContain('Negative space: 55-70%');
  });

  it('데코덴은 볼륨을 쌓으라 하고, 코케트는 납작하게 붙이라 한다', () => {
    expect(build(decoden)).toContain('built UP in volume');
    expect(build(coquette)).toContain('FLAT embossed metal stud');
  });

  it('데코덴·텍스처는 마감 믹싱을 요구하고, 코케트는 단일 마감을 요구한다', () => {
    expect(build(decoden)).toMatch(/Never the same finish|Mix finishes/);
    expect(build(textureGummy)).toMatch(/Never the same finish|Mix finishes/);
    expect(build(coquette)).toContain('One single finish');
  });

  it('뉘앙스는 프렌치 경계선을 배제한다', () => {
    expect(build(nuance)).toContain('a french boundary line');
    expect(build(nuance)).toContain('no boundary line');
  });

  it('텍스처·구미는 질감 줄을 넣고, 코케트는 넣지 않는다', () => {
    expect(build(textureGummy)).toContain('TEXTURE:');
    expect(build(coquette)).not.toContain('TEXTURE:');
  });

  it('4개 코어의 프롬프트는 서로 모두 다르다', () => {
    const prompts = [coquette, nuance, textureGummy, decoden].map(build);
    expect(new Set(prompts).size).toBe(4);
  });
});
