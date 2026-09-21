/**
 * 랜딩 카피·데이터 단일 소스. (2026-09-20 전면 영어화 — 사용자 지시)
 * 수치는 전부 제품 사실이어야 한다 — 없는 실적·후기를 지어내지 않는다.
 *
 * 표현 원칙 두 가지:
 *  1) 발행호 번호(VOL.N)는 화면에 쓰지 않는다. 달력 계산값이라 "N호까지 발행됐다"는
 *     거짓 이력으로 읽힌다 (lib/issue.ts 주석 참조).
 *  2) 착용샷의 손은 AI가 생성한 손이다. "내 손"이라고 쓰지 않는다 —
 *     사용자 손 사진을 받는 입력이 아직 없다.
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
    value: '5',
    label: 'sets per run',
    body: 'One photo set becomes five takes — different colors, structures, and parts.',
    tone: 'green',
  },
  {
    // 이전 값은 '100% / AI 검수 통과작만'이었다. 동어반복이고, 제품은 이미 부분실패를
    // 전제하며 낙제작을 '아쉬운 컷' 배지로 보여준다 — 방어 불가능한 약속이었다.
    // 초대 게이트가 켜져 있는 동안 "하루 3회 무료"는 지킬 수 없는 약속이 된다.
    // 게이트 상태와 무관하게 참인 문장만 남긴다.
    // 순서: 가장 강한 메시지(Free)를 2번째에 — 모바일 1열에서 4번째로 밀리지 않게.
    value: 'Free',
    label: 'no sign-up, no card',
    body: "We never ask for payment info. Failed runs don't count against you.",
    tone: 'pink',
  },
  {
    value: '1',
    label: 'photo to start',
    body: "A screenshot, an outfit, today's sky — start with one, add up to three.",
    tone: 'yellow',
  },
  {
    value: 'Monthly',
    label: 'a fresh issue',
    body: "Refreshed with this month's mood. Never mixed with last month's sets.",
    tone: 'purple',
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
    label: 'Style five variants',
    body: 'Five takes with different colors and structures, appearing as each one finishes.',
  },
  {
    no: '03',
    label: 'AI quality check',
    body: 'Broken sets get filtered out; near-misses are labeled so you always know.',
  },
  {
    no: '04',
    label: 'Try-on preview',
    body: 'See your pick on a hand — an AI-generated hand, for now.',
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

export interface SceneCard {
  persona: string;
  role: string;
  quote: string;
  body: string;
}

/** 실제 후기가 아니라 "이렇게 쓰이면 좋겠다"는 예상 장면 — 화면에도 그렇게 표기한다 */
export const SCENES: SceneCard[] = [
  {
    persona: 'Salon owner',
    role: 'Imagined scene',
    quote: "This month's art set, sorted in a day",
    body: 'Upload the inspiration you saved on Pinterest and get a numbered set — ready to post on Instagram.',
  },
  {
    persona: 'Self-nailer',
    role: 'Imagined scene',
    quote: 'Preview it on a hand first',
    body: 'Check your favorite as a try-on shot. Swap lengths and shapes, then run it again.',
  },
  {
    persona: 'Nail lover',
    role: 'Imagined scene',
    quote: 'A photo to bring to the salon',
    body: 'Show the mood you could never explain in words — with the material combo included.',
  },
];

export interface FaqItem {
  q: string;
  /** 답변은 필수다. 질문만 있는 FAQ는 불안을 활성화하고 해소를 거부한다. */
  a: string;
}

export const FAQS: FaqItem[] = [
  {
    q: 'What photos work best?',
    a: "Anything that carries color and mood — a screenshot, an outfit, today's sky. It doesn't have to be a nail photo. Start with one, add up to three.",
  },
  {
    q: 'Is it free?',
    a: "Yes — no sign-up, no payment. Creating is invite-only for now: AI image generation has real costs, so we're limiting seats while we gauge demand. Leave your email below and we'll tell you when it opens.",
  },
  {
    q: 'How many runs per day?',
    a: "Three a day, refilled at midnight KST. Failed runs don't count.",
  },
  {
    q: 'Where do my photos go?',
    a: "They're used only while creating and never stored on our servers. Generation runs through an external AI model.",
  },
  {
    q: 'Are my sets saved?',
    a: 'Not by default — results live only in your browser tab and vanish when it closes. Download or share the ones you love, or sign in with Google to keep them in your library.',
  },
  {
    q: 'Can I see it worn?',
    a: "Yes — pick a set and tap 'try-on' to see it on a hand. It's an AI-generated hand for now; uploading your own hand photo is in the works.",
  },
  {
    q: 'Can I change length and shape?',
    a: 'Before and after — pick from 4 shapes, 3 lengths, and 4 part levels, then run it again.',
  },
  // 원장님 세그먼트의 결정적 질문. 상업적 사용 가부를 답하지 않으면
  // 시험 삼아 한 번 써보고 끝난다.
  {
    q: 'Can I use the sets to promote my salon?',
    a: "Yes, freely — Instagram posts, consultations, no credit needed. Just tell clients it's an AI concept, since the real manicure may differ.",
  },
  {
    q: 'How many sets is three runs?',
    a: 'Five per run — up to fifteen a day. Plenty to build one monthly art set.',
  },
];
