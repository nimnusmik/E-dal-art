/** 히어로 손 둘레에 뜨는 영감 사진 컷. 사진 교체는 이 배열 한 줄 수정으로 끝난다. */
export type InspoAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface InspoCut {
  /** public 기준 절대경로 */
  src: string;
  /** 화면에 찍히는 번호 */
  no: number;
  /** 한글 라벨 */
  label: string;
  /** CSS에 미리 정의된 배치 앵커 */
  at: InspoAnchor;
}

export const HERO_INSPO: InspoCut[] = [
  { src: '/hero/insp/tattoo.webp', no: 2, label: '타투 플래시', at: 'top-left' },
  { src: '/hero/insp/dreamy.webp', no: 3, label: '몽환 파스텔', at: 'top-right' },
  { src: '/hero/insp/fairycore.webp', no: 4, label: '페어리코어', at: 'bottom-left' },
  { src: '/hero/insp/wings.webp', no: 5, label: '엔젤윙', at: 'bottom-right' },
];
