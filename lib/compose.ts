import type { LengthKey, NailCore } from './core';
import { UNIVERSAL_RULES } from './core';
import type { PhotoMotif, PhotoTake } from './photoTake';
import type { NailShape, PartsIntensity } from './types';

/**
 * 📷 PhotoTake + 🎨 NailCore → 생성 프롬프트.
 * 조립 규칙은 코어 우선(D5): 코어가 구조를 정하고, 사진은 색과 모양만 제공한다.
 */

/**
 * 재질 보존 규칙 (D7).
 *  1. 코어가 다룰 수 있는 재질이면 그대로 유지 — 변환하지 않는다
 *  2. 다룰 수 없으면 제외하고, 다음 prominence 모티프가 그 자리를 채운다
 *  3. motifBudget까지만 채운다 (코어 시그니처가 나머지를 채움)
 */
export function selectMotifs(core: NailCore, motifs: PhotoMotif[]): PhotoMotif[] {
  return motifs
    .filter((m) => core.allowedMaterials.includes(m.material))
    .sort((a, b) => b.prominence - a.prominence)
    .slice(0, core.motifBudget);
}

/** 파츠에 해당하는 재질 — partsIntensity=none 처리에 사용 */
const PART_MATERIALS: ReadonlySet<PhotoMotif['material']> = new Set([
  'metal', 'pearl', 'sculpted',
]);

export interface CoreBrief {
  core: NailCore;
  photo: PhotoTake;
  shape: NailShape;
  length: LengthKey;
  /** 재질 보존 규칙을 통과한 사진 모티프 */
  motifs: PhotoMotif[];
  /** 변주 플랜이 주입하는 팁별 변주 서술. 기본은 빈 배열 */
  patternLines: string[];
  letteringWord: string | null;
}

export interface ComposeOptions {
  shape: NailShape;
  length: LengthKey;
  partsIntensity: PartsIntensity;
}

/**
 * 코어와 사진을 합친다. 코어 우선(D5) — 사진은 팔레트·모티프·무드만 기여한다.
 * 순수 함수 (입력 불변).
 */
export function composeBrief(
  core: NailCore,
  photo: PhotoTake,
  opts: ComposeOptions,
): CoreBrief {
  let motifs = selectMotifs(core, photo.motifs);
  if (opts.partsIntensity === 'none') {
    motifs = motifs.filter((m) => !PART_MATERIALS.has(m.material));
  }
  return {
    core,
    photo,
    shape: opts.shape,
    length: opts.length,
    motifs,
    patternLines: [],
    letteringWord: null,
  };
}

/** 팔레트 한 줄 — 색 이름 + 역할 + 비율. 모델은 hex보다 색 이름을 잘 이해한다 */
function paletteLine(photo: PhotoTake): string {
  const ROLE_WORDS: Record<PhotoTake['palette'][number]['role'], string> = {
    base: 'the ground colour every tip starts from',
    main: 'a colour the design is drawn in',
    accent: 'a small-quantity accent for lines, dots, and metal',
  };
  const parts = photo.palette.map(
    (p) => `${p.nameEn} (${p.hex}, ${Math.round(p.ratio * 100)}% of the surface — ${ROLE_WORDS[p.role]})`,
  );
  return `Palette: ${parts.join('; ')}.`;
}

/** 모티프 한 줄 — 이름 + 재질 + 스케일. 재질은 사진 것을 그대로 지킨다 (D7) */
function motifLine(motifs: PhotoMotif[]): string {
  if (motifs.length === 0) {
    return 'Motifs to use: none — the palette and finish carry the whole set.';
  }
  const SCALE_WORDS: Record<PhotoMotif['scale'], string> = {
    micro: 'micro scale, under 1mm',
    standard: 'standard scale',
    big: 'big scale, 3mm or more',
  };
  const parts = motifs.map((m) => `${m.name} rendered as ${m.material} at ${SCALE_WORDS[m.scale]}`);
  return `Motifs to use, each keeping exactly the material named here: ${parts.join('; ')}.`;
}

/**
 * 프롬프트 조립 — 스펙 6절의 9단 순서를 그대로 따른다.
 * 순서가 규범이다: 모델은 먼저 읽은 지시를 뼈대로 삼으므로 코어가 앞에 온다.
 */
export function buildCorePrompt(brief: CoreBrief): string {
  const { core, photo } = brief;

  const lines: string[] = [];

  // 1. 역할·산출물
  lines.push(
    'You are a top Korean nail artist presenting a design set.',
    `Create ONE photorealistic top-down flat-lay photo of a press-on nail tip sample board: individual ${brief.length} ${brief.shape} nail tips laid out in neat rows on a plain light-grey background, soft even studio lighting.`,
    '',
    'DESIGN BRIEF — follow every line exactly:',
  );

  // 2. 코어 구조
  lines.push(`- ${core.baseLine}`);
  lines.push(`- Structure: ${structureSentence(core)}`);
  lines.push(
    `- Negative space: ${Math.round(core.negativeSpace[0] * 100)}-${Math.round(core.negativeSpace[1] * 100)}% of each tip stays free of motifs.`,
  );
  lines.push(`- ${core.designZone[brief.length]}`);

  // 3. 코어 질감·마감
  if (core.textureGrammar.length > 0) {
    for (const t of core.textureGrammar) lines.push(`- TEXTURE: ${t}`);
  }
  lines.push(`- Finish: ${core.finishMix}`);

  // 4. 코어 시그니처
  for (const s of core.signature) lines.push(`- ${s}`);

  // 5. 사진 팔레트
  lines.push(`- ${paletteLine(photo)}`);

  // 6. 사진 모티프
  lines.push(`- ${motifLine(brief.motifs)}`);

  // 변주 플랜이 있으면 여기에 (팁별 변주는 모티프 다음)
  for (const p of brief.patternLines) lines.push(`- ${p}`);
  if (brief.letteringWord) {
    lines.push(
      `- Exactly one tip carries a single short cursive black script word "${brief.letteringWord}" — written once, on one tip only.`,
    );
  }

  // 7. 사용자 주문
  lines.push(
    `- Tip shape ${brief.shape}, length ${brief.length}. This is the client's order and it holds for every tip on the board.`,
  );

  // 8. 코어 파츠 물리
  lines.push(`- ${core.partsPhysics}`);
  lines.push(
    `- Parts budget for the whole set: ${core.partsBudget.big} statement part${core.partsBudget.big === 1 ? '' : 's'} plus ${core.partsBudget.studs[0]}-${core.partsBudget.studs[1]} small studs or beads in total.`,
  );

  // 9. 코어 금지 + 공통분모
  if (core.forbidden.length > 0) {
    lines.push(`- This set stays clear of: ${core.forbidden.join(', ')}.`);
  }
  for (const rule of UNIVERSAL_RULES) lines.push(`- ${rule}`);

  lines.push(`- Mood: ${photo.moodEn}`);
  lines.push(
    '- The tips are the only subject: plain background, clean composition, no text overlays, nothing else in frame.',
  );

  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** 구조 enum → 영어 문장. 모델은 enum 토큰이 아니라 문장을 이해한다 */
function structureSentence(core: NailCore): string {
  const SENTENCES: Record<NailCore['structure'], string> = {
    'one-tone': 'each tip is one single colour edge to edge, with no boundary and no pattern',
    french: 'each tip has a french boundary near the free edge, with the design inside the tip zone',
    'deep-french':
      'each tip has a deep french boundary running a third to a half down the nail, with the design living only inside that tip zone and the zone above it left empty',
    'full-cover': 'the design covers the whole tip edge to edge, leaving no empty ground',
    'layered-sheer':
      'translucent colour is built up in layers across the whole tip, so depth comes from the stack rather than from any boundary line',
  };
  return SENTENCES[core.structure];
}
