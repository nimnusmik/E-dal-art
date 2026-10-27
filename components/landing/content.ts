/**
 * 랜딩 카피·데이터 단일 소스. (2026-09-20 전면 영어화 — 사용자 지시)
 * 수치는 전부 제품 사실이어야 한다 — 없는 실적·후기를 지어내지 않는다.
 *
 * 표현 원칙 두 가지:
 *  1) 발행호 번호(VOL.N)는 화면에 쓰지 않는다. 달력 계산값이라 "N호까지 발행됐다"는
 *     거짓 이력으로 읽힌다 (lib/issue.ts 주석 참조).
 *  2) "내 손" 표현은 /api/tryon(사용자 손 사진 + SAM 합성)을 가리킬 때만 쓴다.
 *     '착용샷 보기'(/api/hero)의 손은 여전히 AI가 그린 손이다. (2026-10-27 갱신)
 */
import { FREE_CREDITS, PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

export interface StatCard {
  /** 카드 상단 큰 숫자 */
  value: string;
  /** 숫자 아래 제목 */
  label: string;
  /** 설명 두 줄 */
  body: string;
}

export const STATS: StatCard[] = [
  {
    value: '3',
    label: 'nail sets per run',
    body: 'Each run turns your photos into three different sets, with new colors, layouts and details.',
  },
  {
    value: '1',
    label: 'photo to start',
    body: "A screenshot, an outfit, today's sky. Start with one and add up to three.",
  },
  {
    // 값은 짧게 — 카드 폭(최소 220px)에서 큰 글씨로 한 줄에 들어가야 한다 ('Monthly'가 넘쳤음)
    value: 'Yours',
    label: 'try it on your own hand',
    body: 'Upload a photo of your hand. Only the nails change, the rest stays exactly as it is.',
  },
];

export interface ServiceRow {
  no: string;
  label: string;
  /** 항상 펼쳐 두는 설명 한 줄 — 5단계는 접을 이유가 없다 */
  body: string;
}

/**
 * 색은 tone(무지개 5색)이 아니라 인덱스 기반 단일 색조 명도 계단(--step-1..5)을 쓴다.
 * 무작위 5색은 "순서"라는 정보를 파괴해 5단계가 대등한 카테고리로 읽혔다.
 */
export const SERVICES: ServiceRow[] = [
  {
    no: '01',
    label: 'Read the inspiration',
    body: "We read color, texture, and part density from your photos, in this month's mood.",
  },
  {
    no: '02',
    label: 'Style three variants',
    body: 'Three takes with different colors and structures, appearing as each one finishes.',
  },
  {
    no: '03',
    label: 'AI quality check',
    body: 'Broken sets get filtered out; near-misses are labeled so you always know.',
  },
  {
    no: '04',
    label: 'Try it on your hand',
    body: 'Upload a photo of your hand and see your pick on your own nails.',
  },
  {
    no: '05',
    label: 'Publish the issue',
    body: "The mood refreshes every month. Last month's sets never mix in.",
  },
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
 * "실제 결과물"이라는 문구가 거짓이 되므로 절대 섞지 말 것.
 * 출처와 판정 근거는 `public/gallery/SOURCES.md` 참조.
 */
export const GALLERY: GalleryCut[] = [
  { src: '/gallery/pastel-french.jpg', title: 'Pastel French', meta: 'Mint & lemon · pearl chain', tilt: -4 },
  { src: '/gallery/sugar-dot.jpg', title: 'Sugar Dot', meta: 'Burgundy french · lettering', tilt: 3 },
  { src: '/gallery/blue-brown.jpg', title: 'Blue Brown', meta: 'Zebra · marble swirl', tilt: -2 },
  { src: '/gallery/lilac-swirl.jpg', title: 'Lilac Swirl', meta: 'Tone-on-tone relief · lettering', tilt: 5 },
];

export interface FaqItem {
  q: string;
  /** 답변은 필수다. 질문만 있는 FAQ는 불안을 활성화하고 해소를 거부한다. */
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: 'What photos work best?',
    a: "Anything that carries color and mood: a screenshot, an outfit, today's sky. It doesn't have to be a nail photo. Start with one, add up to three.",
  },
  {
    q: 'How much does it cost?',
    // "A/An ${n}-run" 관사 함정을 피해 수사를 뒤로 뺀 문형
    a: `Your first ${FREE_CREDITS} runs are free when you sign in. After that, one pass is ₩${PRICE_REGULAR_KRW.toLocaleString('ko-KR')} for ${PACK_CREDITS} runs. No subscription, just top up when you run out. Each run makes a full set of takes plus try-on shots, and failed runs don't count.`,
  },
  {
    q: 'How many runs per day?',
    a: "Use your runs whenever you like, up to three a day to prevent abuse. Unused runs never expire, and failed runs don't count.",
  },
  {
    q: 'Where do my photos go?',
    a: "They're used only while creating and never stored on our servers. Generation runs through an external AI model.",
  },
  {
    q: 'Are my sets saved?',
    a: 'Not by default. Results live only in your browser tab and vanish when it closes. Download or share the ones you love, or sign in with Google to keep them in your library.',
  },
  {
    q: 'Can I see it worn?',
    a: "Yes. Pick a set, tap 'Try it on my hand' and upload a photo of the back of your hand. We find your nails and paint only them, so your hand stays exactly as it is.",
  },
  {
    q: 'Can I change length and shape?',
    a: 'Before and after. Pick from 4 shapes, 3 lengths, and 4 part levels, then run it again.',
  },
  // 원장님 세그먼트의 결정적 질문. 상업적 사용 가부를 답하지 않으면
  // 시험 삼아 한 번 써보고 끝난다.
  {
    q: 'Can I use the sets to promote my salon?',
    a: "Yes, freely. Use them for Instagram posts and consultations, no credit needed. Just tell clients it's an AI concept, since the real manicure may differ.",
  },
  {
    q: 'How many sets do I get?',
    a: 'Three per run, so your free runs alone give you nine sets. Plenty to build one monthly art set.',
  },
];
