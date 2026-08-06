import type { NailCore } from '@/lib/core';
import { coquette } from './coquette';

/**
 * 등록된 코어. 배열 순서는 무의미하며, UI 정렬은 noise 오름차순으로 계산한다.
 * 스펙 2-2절의 15종 중 단계 1~3 범위인 4종만 우선 등록.
 */
export const CORES: NailCore[] = [coquette];
