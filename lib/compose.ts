import type { NailCore } from './core';
import type { PhotoMotif } from './photoTake';

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
