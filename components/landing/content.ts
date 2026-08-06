/**
 * 랜딩 카피·데이터 단일 소스.
 * 수치는 전부 제품 사실이어야 한다 — 없는 실적·후기를 지어내지 않는다.
 */
export type Tone = 'pink' | 'blue' | 'yellow' | 'green' | 'purple';

export interface StatCard {
  /** 카드 상단 큰 숫자 */
  value: string;
  /** 숫자 아래 제목 */
  label: string;
  /** 설명 두 줄 */
  body: string;
  /** 모서리 블롭 색 */
  tone: Tone;
}

export const STATS: StatCard[] = [
  {
    value: '5종',
    label: '한 번에 나오는 시안',
    body: '사진 한 세트로 색·구조·파츠가 다른 다섯 갈래를 동시에 만들어요.',
    tone: 'green',
  },
  {
    value: '3장',
    label: '필요한 영감 사진',
    body: '스크린샷, 좋아하는 옷, 오늘의 하늘. 최대 세 장이면 충분해요.',
    tone: 'yellow',
  },
  {
    value: '100%',
    label: 'AI 검수 통과작만',
    body: '파츠 배치와 물리 법칙을 검수해 통과한 시안만 화면에 올라와요.',
    tone: 'pink',
  },
  {
    value: '매월',
    label: '새로 발행되는 호',
    body: '이달의 무드로 갱신돼요. 지난달 시안과 섞이지 않아요.',
    tone: 'purple',
  },
];

export interface ServiceRow {
  no: string;
  label: string;
  tone: Tone;
}

export const SERVICES: ServiceRow[] = [
  { no: '01', label: '영감 사진 분석', tone: 'pink' },
  { no: '02', label: '5종 변주 생성', tone: 'blue' },
  { no: '03', label: 'AI 품질 검수', tone: 'yellow' },
  { no: '04', label: '손 착용샷 합성', tone: 'green' },
  { no: '05', label: '이달의 호 발행', tone: 'purple' },
];

export interface GalleryCut {
  /** public 기준 절대경로 */
  src: string;
  title: string;
  /** 카드 하단 메타 문구 */
  meta: string;
  /** 폴라로이드 기울기(도) */
  tilt: number;
}

/**
 * 실제 생성·검수를 통과한 시안만 싣는다. 영감 사진(`/hero/insp/*`)을 여기 쓰면
 * "이런 시안이 나와요"라는 문구가 거짓이 되므로 절대 섞지 말 것.
 * 출처와 판정 근거는 `public/gallery/SOURCES.md` 참조.
 */
export const GALLERY: GalleryCut[] = [
  { src: '/gallery/celestial-gold.jpg', title: '천체 골드', meta: '마블 · 골드 글리터', tilt: -4 },
  { src: '/gallery/citrus.jpg', title: '시트러스', meta: '오렌지 프렌치 · 감귤', tilt: 3 },
  { src: '/gallery/dot-gingham.jpg', title: '도트 깅엄', meta: '핑크·블루 체크 · 로즈', tilt: -2 },
  { src: '/gallery/lilac-check.jpg', title: '라일락 체크', meta: '라일락 깅엄 · 핑크 로즈', tilt: 5 },
];

export interface SceneCard {
  persona: string;
  role: string;
  quote: string;
  body: string;
}

/** 실제 후기가 아니라 "이렇게 쓰이면 좋겠다"는 예상 장면 — 화면에도 그렇게 표기한다 */
export const SCENES: SceneCard[] = [
  {
    persona: '네일샵 원장',
    role: '예상 사용 장면',
    quote: '이달의 아트 세트를 하루 만에 정리해요',
    body: '핀터레스트에 모아둔 영감을 올리면 번호가 붙은 시안 세트가 나와요. 인스타에 그대로 올릴 수 있어요.',
  },
  {
    persona: '셀프 네일러',
    role: '예상 사용 장면',
    quote: '내 손에 올린 모습까지 미리 봐요',
    body: '마음에 든 시안은 착용샷으로 확인해요. 길이와 쉐입을 바꿔가며 비교할 수 있어요.',
  },
  {
    persona: '네일 러버',
    role: '예상 사용 장면',
    quote: '샵에 가져갈 사진이 생겨요',
    body: '말로 설명하기 어려웠던 무드를 시안 한 장으로 보여줘요. 재료 조합까지 함께 나와요.',
  },
];

export interface FaqPill {
  q: string;
  tone: Tone;
}

export const FAQS: FaqPill[] = [
  { q: '어떤 사진을 올리면 좋아요?', tone: 'pink' },
  { q: '하루에 몇 번까지 만들 수 있어요?', tone: 'green' },
  { q: '무료인가요?', tone: 'yellow' },
  { q: '시안은 저장되나요?', tone: 'blue' },
  { q: '손 착용샷도 만들 수 있어요?', tone: 'purple' },
  { q: '길이랑 쉐입을 바꿀 수 있어요?', tone: 'pink' },
];
