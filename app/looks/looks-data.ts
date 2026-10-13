/**
 * 아카이브 큐레이션 단일 소스 — 여기 넣은 것만 /looks에 걸린다.
 * 전부 실제 생성 파이프라인 결과물(ref/results)에서 고른 것. 영감 사진 금지.
 * 원본 경로는 기록용 주석 — ref/는 gitignore라 public/looks 사본이 배포본이다.
 */
export interface Look {
  /** public/looks (아카이브 전용) 또는 public/gallery (랜딩과 공유) */
  src: string;
  title: string;
  /** 재료·기법 한 줄 */
  meta: string;
  /** 발행 연월 표기 */
  issue: string;
  /** 그리드에서 크게 걸리는 대표작 */
  featured?: boolean;
}

export const LOOKS: Look[] = [
  // ── 2026-10 · 주인공 위계 파이프라인 첫 작 ─────────────────
  {
    src: '/looks/winged-heart-french.jpg',
    title: 'Winged Heart French',
    meta: 'Hand-painted wings · sheer french · one hero tip',
    issue: 'OCT 2026',
    featured: true,
  },
  {
    src: '/looks/winged-heart-jelly.jpg',
    title: 'Winged Heart Jelly',
    meta: 'Aurora jelly gradient · sculpted heart centerpiece',
    issue: 'OCT 2026',
  },
  {
    src: '/looks/winged-heart-kitsch.jpg',
    title: 'Winged Heart Kitsch',
    meta: '3D buttons & blooms · pastel colour blocks',
    issue: 'OCT 2026',
  },
  // ── 2026-09 · 스틸레토 3부작 (내부 평가 1위 세트) ──────────
  {
    src: '/looks/glass-tears.jpg',
    title: 'Glass Tears',
    meta: 'Jelly stiletto · moonstone drops · lace line work',
    issue: 'SEP 2026',
    featured: true,
  },
  {
    src: '/looks/stiletto-garden.jpg',
    title: 'Stiletto Garden',
    meta: 'Hand-painted vines · candy stripes · star studs',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/porcelain-toybox.jpg',
    title: 'Porcelain Toybox',
    meta: 'Sculpted 3D · piped frames · waffle relief',
    issue: 'SEP 2026',
  },
  // ── 2026-09 · 라일락 수채 2부작 ────────────────────────────
  {
    src: '/looks/lilac-bloom.jpg',
    title: 'Lilac Bloom',
    meta: 'Glass petals · airbrushed ombré · coffin tips',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/star-watercolor.jpg',
    title: 'Star Watercolor',
    meta: 'Watercolour stars · pressed-flower wash',
    issue: 'SEP 2026',
  },
  // ── 2026-09 · 포맷 실험 ───────────────────────────────────
  {
    src: '/looks/tweed-petit.jpg',
    title: 'Tweed Petit',
    meta: 'Short round · real tweed texture · 4 colourways',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/picnic-case.jpg',
    title: 'Picnic Case',
    meta: 'Press-on set in case · strawberry french',
    issue: 'SEP 2026',
    featured: true,
  },
  // ── 2026-08 · 해석 파일럿 (interpret·coquette·lettering 계열) ──
  {
    src: '/looks/angel-lace.jpg',
    title: 'Angel Lace',
    meta: 'Burgundy french · white lace · script lettering',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/blue-zebra-french.jpg',
    title: 'Blue Zebra French',
    meta: 'Zebra & croc texture · powder blue · deep brown',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/marble-gold.jpg',
    title: 'Marble & Gold',
    meta: 'White marble · gold dust · celestial studs',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/tangerine-gingham.jpg',
    title: 'Tangerine Gingham',
    meta: 'Hand-painted tangerines · green gingham',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/purple-swirl.jpg',
    title: 'Purple Swirl',
    meta: 'Swirl doodles · violet french · diagonal board',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/dot-check-french.jpg',
    title: 'Dot Check French',
    meta: 'Micro dots · gingham check · silver beads',
    issue: 'AUG 2026',
  },
  // ── 2026-09 · 코어 후보 실험 (데코덴·누앙스·텍스처) + run2 ──
  {
    src: '/looks/bunny-pastel.jpg',
    title: 'Bunny Pastel',
    meta: 'Rabbit relief · lace line · rainbow sheen',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/heart-chrome.jpg',
    title: 'Heart Chrome',
    meta: 'Silver heart frame · pearl drops · pink wash',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/berry-heart.jpg',
    title: 'Berry Heart',
    meta: 'Burgundy ombré · jelly hearts · bead trail',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/orchid-decoden.jpg',
    title: 'Orchid Decoden',
    meta: 'Sculpted orchid & rose · chrome · burgundy',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/baroque-pearl.jpg',
    title: 'Baroque Pearl',
    meta: 'Relief scrolls · pearl rows · gothic letter',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/agate-zebra.jpg',
    title: 'Agate Zebra',
    meta: 'Agate marble · teal & plum · zebra accent',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/knit-and-leopard.jpg',
    title: 'Knit & Leopard',
    meta: 'Gummy knit relief · leopard · chrome letter',
    issue: 'SEP 2026',
  },
  {
    src: '/looks/cable-knit-french.jpg',
    title: 'Cable Knit French',
    meta: 'Cable knit · zebra swirl · pink french',
    issue: 'SEP 2026',
  },
  // ── 2026-08 · 코케트 파일럿 10세트 ─────────────────────────
  {
    src: '/looks/coquette-01.jpg',
    title: 'Angel Script',
    meta: 'Lilac dot french · script lettering · anchor',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-02.jpg',
    title: 'Sailor Rose',
    meta: 'Yellow & teal stripes · 3D rose · silver beads',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-03.jpg',
    title: 'Gingham Dot',
    meta: 'Blue gingham · micro dots · bead belt',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-04.jpg',
    title: 'Plum Swirl French',
    meta: 'Plum ombré french · pearl drop · anchor line work',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-05.jpg',
    title: 'Lace Parade',
    meta: 'White lace trim · cocoa french · candy dots',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-06.jpg',
    title: 'Lemon Angel',
    meta: 'Lemon dots · script lettering · star stud',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-07.jpg',
    title: 'Black Tip Rose',
    meta: 'Black-tipped french · pinstripes · 3D roses',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-08.jpg',
    title: 'Lilac Gingham',
    meta: 'Lilac gingham ovals · ink outline · bead studs',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-09.jpg',
    title: 'Cocoa Waves',
    meta: 'Cocoa french · wave lines · anchor & pearl',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/coquette-10.jpg',
    title: 'Sailor Coquette',
    meta: 'Pink dots · lace trim · blue tips · anchor',
    issue: 'AUG 2026',
  },
  // ── 2026-08 · 코케트 v2·레터링·검수 파일럿 ─────────────────
  {
    src: '/looks/confetti-dots.jpg',
    title: 'Confetti Dots',
    meta: 'Dotted french · 20-tip board · bead accents',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/stripe-angel.jpg',
    title: 'Stripe Angel',
    meta: 'Pin stripes · script lettering · star studs',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/check-and-chain.jpg',
    title: 'Check & Chain',
    meta: 'Gingham & grid tips · bead belt line',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/mini-french-grid.jpg',
    title: 'Mini French Grid',
    meta: 'Micro french · teal & lemon · 20-tip board',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/plaid-mix.jpg',
    title: 'Plaid Mix',
    meta: 'Plaid · pinline french · ink accents',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/gingham-rose.jpg',
    title: 'Gingham Rose',
    meta: 'Lilac gingham · 3D rose · sheer stiletto',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/berry-swirl.jpg',
    title: 'Berry Swirl',
    meta: 'Swirl doodles · berry french · 20-tip board',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/cherry-lace.jpg',
    title: 'Cherry Lace',
    meta: 'Lace trim · cherry & blue french · dots',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/sugar-board.jpg',
    title: 'Sugar Board',
    meta: 'Milk french 20 tips · script word · pastel pops',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/honey-french.jpg',
    title: 'Honey French',
    meta: 'Ivory french · script word · pastel pinlines',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/cherie-plaid.jpg',
    title: 'Cherie Plaid',
    meta: 'Pink plaid · black tips · dotted outline',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/plum-ribbon.jpg',
    title: 'Plum Ribbon',
    meta: 'Plum swirl relief 16 tips · tonal french',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/bonbon-dots.jpg',
    title: 'Bonbon Dots',
    meta: 'Choco dots · lace french · script word',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/angel-plaid-pastel.jpg',
    title: 'Angel Plaid Pastel',
    meta: 'Teal & lemon french · plaid · 3D rose',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/gold-dust-nude.jpg',
    title: 'Gold Dust Nude',
    meta: 'Sheer nude · gold dust · moon & star studs',
    issue: 'AUG 2026',
  },
  {
    src: '/looks/tangerine-picnic.jpg',
    title: 'Tangerine Picnic',
    meta: 'Tangerine orange · gingham · daisy accents',
    issue: 'AUG 2026',
  },
  // ── 2026-07 · 첫 세대 — 올리브·골드 톤과 착용샷 ───────────
  {
    src: '/looks/olive-stiletto-tryon.jpg',
    title: 'Olive Stiletto',
    meta: 'Try-on shot · olive ombré · gold line work',
    issue: 'JUL 2026',
    featured: true,
  },
  {
    src: '/looks/autumn-donut-tryon.jpg',
    title: 'Autumn Donut',
    meta: 'Try-on shot · amber ombré · sculpted donut',
    issue: 'JUL 2026',
  },
  {
    src: '/looks/olive-burgundy.jpg',
    title: 'Olive & Burgundy',
    meta: 'Vine painting · pearl drops · silver accent',
    issue: 'JUL 2026',
  },
  {
    src: '/looks/sea-glass-gold.jpg',
    title: 'Sea Glass Gold',
    meta: 'Teal washes · gold bead clusters · water drops',
    issue: 'JUL 2026',
  },
  {
    src: '/looks/mint-chrome-tryon.jpg',
    title: 'Mint Chrome',
    meta: 'Try-on shot · mint & silver · gold beads',
    issue: 'JUL 2026',
  },
  {
    src: '/looks/silver-petal-tryon.jpg',
    title: 'Silver Petal',
    meta: 'Try-on shot · glitter silver · sage ombré',
    issue: 'JUL 2026',
  },
  {
    src: '/looks/donut-garden.jpg',
    title: 'Donut Garden',
    meta: 'Sculpted donut & bow · olive gradient',
    issue: 'JUL 2026',
  },
  {
    src: '/looks/rose-quartz-set.jpg',
    title: 'Rose Quartz Set',
    meta: 'Milky pink · sculpted petal · silver accent',
    issue: 'JUL 2026',
  },
  // ── 랜딩 "Looks of the month"와 공유되는 4점 ───────────────
  { src: '/gallery/pastel-french.jpg', title: 'Pastel French', meta: 'Mint & lemon · pearl chain', issue: 'SEP 2026' },
  { src: '/gallery/sugar-dot.jpg', title: 'Sugar Dot', meta: 'Burgundy french · lettering', issue: 'SEP 2026' },
  { src: '/gallery/blue-brown.jpg', title: 'Blue Brown', meta: 'Zebra · marble swirl', issue: 'SEP 2026' },
  { src: '/gallery/lilac-swirl.jpg', title: 'Lilac Swirl', meta: 'Tone-on-tone relief · lettering', issue: 'SEP 2026' },
];
