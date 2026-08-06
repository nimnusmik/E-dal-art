# 네일 코어 프리셋 15종 설계 (2026-08-06)

> 사용자가 **미감 코어(-core)를 직접 선택**하고, 코어마다 **독립된 프롬프트 헌법**을
> 갖는 구조로 생성 엔진을 재편한다.

## 1. 문제

현재 엔진은 **"코케트 파스텔 미니멀" 한 가지 스타일에만 맞춰진 전역 헌법**을 갖고 있다.
어떤 사진을 넣어도 결과가 코케트로 수렴한다.

전역 강제의 실제 위치:

| 위치 | 내용 | 막고 있는 것 |
|---|---|---|
| `lib/prompt.ts:24` `HUMAN_ARTIST_LINES` | "dangling rings, oversized 3D parts" 금지 | 실버 링, 큰 3D 조소 파츠 |
| `lib/brief.ts:192` `PARTS_PHYSICS` | 모든 파츠는 "납작하게 눌러 붙인 스터드" | 양각·젤 볼륨·3D 조소 |
| `lib/brief.ts:198-205` `LENGTH_RULES` | 디자인 영역 20~45% | 풀커버 텍스처 |
| `ref/trendy/STYLE_ANALYSIS.md:194` forbidden | 마블·매트·크롬풀커버·풀패턴 0회 | 크롬·애니멀 프린트 |
| `lib/judge.ts` `expectedMetalTips` | 파츠 팁 개수 초과 시 탈락 | 파츠 다수 코어 |

또한 **텍스처가 `textureLine` 문자열 한 칸**뿐이다. 2026년 트렌드의 1순위 축이
스키마상 곁가지로 취급된다.

**추가 결함**: `lib/judge.ts`는 **브리프 대비**만 채점한다. 브리프 자체가 사진 특징을
놓쳤을 경우 잡을 방법이 없다.

## 2. 트렌드 조사 결과 (2026-08-06)

### 2-1. 핵심 발견

- **뉘앙스 네일(Nuance Nails)이 2026년 1순위**. 일본·한국 발원. 도쿄 네일 엑스포에서
  본 것의 85%가 뉘앙스였다는 증언. **현재 엔진에 개념 자체가 없다.**
  문법: 시어 레이어 겹치기 → 캣아이 위 스월링 → 크롬 윤곽 → "광물 단면" 같은 깊이.
- **Pinterest Predicts 2026**: `tactile nail art`, `3D gummy nails` 검색량 **+180%**.
  플랫 컬러 → 촉각적 질감으로 전환.
- **2026 키워드는 "정제된 맥시멀리즘"과 "마감 믹싱"**. 한 세트에 매트·글로시·크롬·벨벳을
  섞는 것이 핵심 기술. 같은 광 9개보다 깊이가 생긴다.
- **글로벌과 한국이 반대 방향**: 한국 2026 여름은 "풀파츠·글리터 후퇴, 맑고 투명한 무드".
  단 **갸루 코어가 뉴트로로 재부상** — 풀파츠는 *주류 이탈 + 서브컬처 부상*의 역방향 병존.
- **대중 수요는 "풀 장식"이 아니라 "텍스처"**: 고객은 풀 3D 참 세트는 망설이지만 텍스처
  마감으로 입체감을 낸다. → 텍스처 코어(대중) 와 데코덴 코어(마니아)를 **분리해야 한다.**

### 2-2. 코어 15종 (조용함 → 시끄러움)

| # | id | 코어 (nameKo) | 시각 문법 | 파츠 | noise |
|---|---|---|---|---|---|
| 1 | `clean-girl` | 클린걸 | 원톤 시어·밀키·글레이즈드, 시폰 한 겹, 짧은 스쿠발. 팔레트 변주: 라떼·모카·체리모카 | 0 | 1 |
| 2 | `jelly-syrup` | 젤리·시럽 | 반투명 시럽 베이스 + 물방울 젤 볼륨, 젤리핑크·클라우드댄서 | 0 | 1 |
| 3 | `nuance` ★ | 뉘앙스 | 시어 레이어 겹치기 + 캣아이 위 스월링 + 크롬 윤곽. 포레스트그린·웜브라운·심해블루 | 0~1 | 2 |
| 4 | `ballet` | 발레 | 발레 슬리퍼 핑크·누드, 치크 네일, 극세 마이크로 프렌치 | 0~1 | 2 |
| 5 | `aura-blooming` | 오라·블루밍 | 방사형 확산 그라데이션, 블루밍젤, 핑크+옐로우 | 0~1 | 2 |
| 6 | `chrome-velvet` | 크롬·벨벳 | 미러/샴페인 크롬, 자석젤 벨벳 캣아이 빛줄기, 크롬 프렌치 | 0~2 | 3 |
| 7 | `mermaid-pearl` | 머메이드·자개 | 마더오브펄, 쉘 리지, 비늘 실버, 씨폼·터콰이즈, 3D 미니 펄 | 1~3 | 3 |
| 8 | `linework` | 그래픽 라인워크 | 아르가일·타탄·깅엄·플레이드·스트라이프, 얇은 선 2~3색 | 0~1 | 3 |
| 9 | `coquette` ✅ | 코케트 | 딥프렌치 + 도트·레이스·리본·진주, 여백 60% | 1~2 | 3 |
| 10 | `cottage-fairy` | 코티지·페어리 | 손그림 꽃·딸기·머쉬룸, 레이스 프릴 경계, 이리데센트 | 1~2 | 3 |
| 11 | `nail-jewellery` | 네일 주얼리 | 포인트백 크리스탈 절제 배치, 큐티클 쪽 메탈 라인, 웨딩 럭스 | 2~4 | 3 |
| 12 | `texture-gummy` ★ | 텍스처·구미 | 3D 양각 엠보싱, 케이블니트, 젤리 방울, 마감 믹싱 | 0~2 | 4 |
| 13 | `y2k-mcbling` | Y2K·맥블링 | 십자가·별·링, 실버 하드웨어, 크롬하츠, 필기체 레터링 | 3~6 | 4 |
| 14 | `dark-glam` | 다크글램·몹와이프 | 옥스블러드·와인·블랙, 레오파드·제브라·스네이크 | 2~4 | 4 |
| 15 | `decoden` ★ | 데코덴·갸루 | 롱팁 풀파츠, 3D 조소 플라워·백합, 버블 진주 클러스터, 바로크 양각 | 5+ | 5 |

★ = 현재 엔진이 구조적으로 못 만드는 것 / ✅ = 이미 검증 완료

**코어로 만들지 않은 것과 이유**:
- 뉴 프렌치 / 마이크로 프렌치 / 사선 프렌치 → 모든 코어에 걸치는 **구조 옵션**
- 라떼·모카·체리모카 → 문법이 클린걸과 동일. **팔레트 변주**로 처리
- 샤프 실루엣(캣클로우) → 쉐입 축. 기존 `shape` 파라미터

**참조 사진 좌표**: `ref/trendy/IMG_6259.jpg`(Vickeenails)는 15 + 14 + 13의 교집합.
중심은 15번. 한 코어로 담기지 않으므로 코어 조합은 후속 과제로 둔다.

## 3. 설계 결정

| # | 결정 | 선택 | 근거 |
|---|---|---|---|
| D1 | 스타일 전환 방식 | 사용자가 코어 직접 선택 | 취향은 사용자 것 |
| D2 | 코어 수 | 15종 전부 | 조사에서 확인된 실제 수요 축 |
| D3 | 표현 형태 | 하이브리드 (데이터 축 + 자유 작문 블록) | 공통 규칙 1곳 관리 + 코어 개성 확보 |
| D4 | 프롬프트 언어 | 영어 (사용자 노출 텍스트만 한국어) | 모델은 영어 캡션으로 학습. `charm`→펜던트, `anchor`→⚓ 같은 함정 통제는 영어에서만 가능 |
| D5 | 사진 vs 코어 충돌 | **코어 우선** | "뭘 넣어도 코케트로 뭉갠다"가 원래 문제. 사용자가 코어를 직접 골랐으므로 |
| D6 | 사진 첨부 여부 | 스위치로 두고 3단계 실측에서 확정 (기본 `false`) | 파일럿에서 텍스트 브리프만으로 충실도 90~95% 확인 (`ref/results/pilot-interpret/REPORT.md`) |
| D7 | 사진 재질 | **보존 + 코어 증강** (변환 금지) | 사용자가 본 재질이 사라지면 안 됨 |
| D8 | 재생성 루프 | 만들지 않음. judge는 점수만 기록 | 현행 `app/api/variant/route.ts:13`과 동일 |
| D9 | 코어 선택 시점 | 사진 업로드 **전** | 첫 화면이 곧 코어 선택 |
| D10 | 선택 UI | 평면 그리드 + 스티키 구간 라벨 (접힘 없음) | 네일 고르는 행동은 "읽기"가 아니라 "보기" |

## 4. 소유권 분리 (D5의 실행 규칙)

| 항목 | 소유자 |
|---|---|
| 팔레트 (색 + 역할 + 배합비) | 📷 사진 |
| 모티프 (이름 + 재질 + 스케일) | 📷 사진 |
| 무드 (한국어 키워드 + 영문 한 줄) | 📷 사진 |
| 베이스·구조 (딥프렌치 / 풀커버 / 원톤) | 🎨 코어 |
| 여백률 | 🎨 코어 |
| 텍스처 문법 | 🎨 코어 |
| 마감 믹싱 | 🎨 코어 |
| 파츠 물리 + 예산 | 🎨 코어 |
| 금지 항목 | 🎨 코어 |
| 쉐입·길이·파츠강도 | 🙋 사용자 주문 |

**사진은 "색과 모양"을, 코어는 "만드는 방식"을 담당한다.**

### 전역 → 코어별 이동

`PARTS_PHYSICS`, `LENGTH_RULES`, `HUMAN_ARTIST_LINES`의 스타일 규칙을 코어 레코드로 옮긴다.
**공통분모로 남기는 것은 4줄뿐**:

1. 사람 손으로 젤·파우더·필름·파츠로 실제 시술 가능해야 한다
2. AI 티(플라스틱 피부, 손가락 왜곡, 녹은 손톱 경계) 없음
3. 손톱은 손가락에서 자라난 것 — 피부 위에 놓인 물체가 아님
4. 눈·얼굴 모티프 금지

"링 금지", "큰 3D 파츠 금지", "여백 60%"는 **코케트 코어의 규칙**일 뿐이며,
데코덴 코어에서는 필수 요소다. 이것이 현재 엔진이 IMG_6259를 못 만드는 근본 원인이다.

## 5. 데이터 구조

### 5-1. NailCore (`lib/core.ts`, 코어 파일은 `config/cores/*.ts`)

```ts
export type Material =
  | 'painted' | 'gel-volume' | 'metal' | 'pearl' | 'chrome' | 'sculpted';

export interface NailCore {
  id: string;                    // 'decoden'
  nameKo: string;                // '데코덴·갸루'  — 사용자 노출
  taglineKo: string;             // '손톱을 조형물로' — 카드 설명
  noise: 1 | 2 | 3 | 4 | 5;      // 그리드 정렬 순서

  // ── 구조 (영어, 모델 입력) ──
  baseLine: string;
  structure: 'one-tone' | 'french' | 'deep-french' | 'full-cover' | 'layered-sheer';
  negativeSpace: [number, number];              // 여백률 범위
  designZone: Record<'short' | 'medium' | 'long', string>;  // 기존 LENGTH_RULES 대체

  // ── 질감·마감 (신규) ──
  textureGrammar: string[];
  finishMix: string;

  // ── 파츠 ──
  partsPhysics: string;                         // 코어별 물리 법칙
  partsBudget: { big: number; studs: [number, number] };
  allowedMaterials: Material[];                 // D7 재질 보존 판정용

  // ── 개성 (자유 작문 3~5줄, 영어) ──
  signature: string[];

  // ── 제약 ──
  forbidden: string[];                          // 이 코어에서만 금지

  // ── 변주 ──
  variantOps: string[];                         // 코어별 변주 연산자

  // ── 생성 옵션 ──
  attachPhoto: boolean;                         // D6, 기본 false

  // ── 검수 ──
  judge: {
    minPartsTips: number;
    maxPartsTips: number;
    allowGelVolume: boolean;
    minNegativeSpace: number;
  };
}
```

### 5-2. PhotoTake (`lib/photoTake.ts`)

```ts
export interface PhotoTake {
  palette: Array<{
    hex: string;
    role: 'base' | 'main' | 'accent';
    ratio: number;              // 0~1, 합계 1.0
    nameEn: string;             // 'baby pink' — 모델은 색 이름을 hex보다 잘 이해함
  }>;

  motifs: Array<{
    name: string;               // 'polka dot' | 'leopard print' | 'baroque relief'
    material: Material;
    scale: 'micro' | 'standard' | 'big';
    prominence: 1 | 2 | 3;      // 사진에서의 지배력 — 예산 배분 순위
  }>;                           // 상한 8개, 개수 제한 없이 뽑음

  moodKo: string[];
  moodEn: string;

  tone: {
    saturation: 'muted' | 'medium' | 'vivid';
    brightness: 'dark' | 'mid' | 'light';
    temperature: 'cool' | 'neutral' | 'warm';
  };

  fidelityAnchors: string[];    // "반드시 살아야 함" 2~3개, 검수용
}
```

**기존 대비 개선점**:
- 팔레트에 **역할·배합비** 추가 — `STYLE_ANALYSIS.md:168`의 실측 규칙(60/30/10)을 담을 자리
- 모티프를 **`name` + `material` + `scale`로 분해** — 구조와 분리되어 코어가 재조립 가능
- 모티프 개수 제한 없음 — IMG_6259처럼 팁 40개짜리 보드도 정보를 잃지 않음

### 5-3. 재질 보존 규칙 (D7)

1. 사진 모티프의 `material`이 코어의 `allowedMaterials`에 있으면 → **그대로 유지**
2. 없으면 → 그 모티프는 **제외**(변환하지 않음). `prominence` 다음 순위로 채움
3. 코어의 `signature` 재질은 **별도 팁에 추가** — 사진 모티프와 공존
4. 예산 충돌 시: 코어 시그니처가 **1팁만 먼저 확보**, 남은 예산은 사진 모티프 `prominence` 순

## 6. 파이프라인

```
사진 → extractPhotoTake ── PhotoTake (팔레트·모티프·무드)     📷
                                    ↓
코어 선택 ──────────── NailCore (구조·질감·파츠·금지·검수)     🎨
                                    ↓
                        composeBrief(core, photoTake, options)
                                    ↓ planVariants(core.variantOps)
                                    ↓ buildCorePrompt
                                    ↓ judgeImage(코어 기준 + 원본 충실도)
```

### 프롬프트 조립 순서 (D5 — 코어가 먼저)

모델은 먼저 읽은 지시를 뼈대로 삼으므로 순서가 규범이다.

```
1. 역할·산출물          "You are a top Korean nail artist... flat-lay tip board"
2. 🎨 코어 구조         baseLine / structure / negativeSpace / designZone
3. 🎨 코어 질감·마감     textureGrammar / finishMix
4. 🎨 코어 시그니처      signature 3~5줄
5. 📷 사진 팔레트        "Palette: <색 이름 + 역할 + 비율>"
6. 📷 사진 모티프        "Motifs to use: <이름 + 재질 + 스케일>"
7. 🙋 사용자 주문        shape / length / partsIntensity
8. 🎨 코어 파츠 물리     partsPhysics + partsBudget
9. 🎨 코어 금지 + 공통   forbidden + 공통분모 4줄
```

### 변주 연산자 코어별 분리

현재 `fallbackPlans`의 v4는 `ZERO_PARTS_LINE`(핸드페인트 온리)이다.
코케트에서는 좋은 변주지만 데코덴에서는 정체성 파괴다.

```ts
// 코케트
variantOps: ['invert', 'rescale', 'density', 'zero-parts', 'boundary-swap']
// 데코덴
variantOps: ['material-swap', 'volume-up', 'cluster-density', 'palette-rotate', 'motif-swap']
```

### judge 확장

```ts
export interface NailJudgement {
  // ... 기존 항목 유지 ...
  paletteFidelity: boolean;    // 추출 팔레트의 역할·비율이 지켜졌나
  motifFidelity: number;       // fidelityAnchors 중 살아있는 개수
  coreFidelity: boolean;       // 선택 코어의 정체성이 드러나나
}
```

원본 사진과 생성 이미지를 **둘 다** 검수기에 넘긴다. 검수 원가는 장당 수 원이므로
이미지 2장도 부담 없다(생성이 비용의 85%+).

파츠 개수 기대값은 `lib/judge.ts:expectedMetalTips`가 `partsLine` 문자열을 정규식으로
파싱해 추정하던 방식을 버리고, **`core.judge.minPartsTips` / `maxPartsTips`를 직접 읽는다.**
문자열 파싱 추정이 사라지므로 `ZERO_PARTS_LINE` 특수 판별(`isZeroParts`)도 불필요해진다.

**D8에 따라 이 세 항목은 점수만 기록하고 탈락 게이트로 쓰지 않는다.**

## 7. UI (D9, D10)

업로드 전 선택이므로 **추천 배지는 폐기**한다(사진이 없어 계산 불가).

```
┌────────────────────────────────────────┐
│  어떤 네일을 만들까요?                    │
│  스크롤할수록 화려해져요 ↓                 │
├────────────────────────────────────────┤
│ ─ 맑고 은은하게 ──────────── (sticky)   │
│  [클린걸] [젤리·시럽]                    │
│  [뉘앙스] [발레]                         │
│  [오라·블루밍]                           │
│ ─ 포인트를 살짝 ────────── (sticky)     │
│  [크롬·벨벳] [머메이드·자개]              │
│  [라인워크] [코케트]                     │
│  [코티지·페어리] [네일주얼리]             │
│ ─ 확실하게 화려하게 ────── (sticky)      │
│  [텍스처·구미] [Y2K·맥블링]              │
│  [다크글램] [데코덴·갸루]                 │
└────────────────────────────────────────┘
```

- **접지 않는다.** 이미지를 숨기면 "보고 고르는" 행동 자체가 막힌다
- 정렬을 `noise` 순으로 두어 **스크롤이 슬라이더 역할**을 한다
- 구간 라벨은 사용자 말로: "맑고 은은하게 / 포인트를 살짝 / 확실하게 화려하게"
  (개발 용어 "조용한 쪽/시끄러운 쪽" 아님)
- 모바일 2열 / 데스크톱 4열, 카드 = 정사각 이미지 + 이름 + 태그라인 한 줄
- 카드 글자는 최소 — 이미지가 90%를 설명
- 선택 시 하단 고정 CTA "사진 올리기 →"

**전제 조건**: 코어당 샘플 이미지 1장, 총 15장. 이미지가 없으면 글자 목록이 되고
그건 반대한 화면이다. **15장 확보가 실질적 관문.**

### API 변경

```ts
// POST /api/analyze  요청
{ images, shape, length, partsIntensity, coreId: 'decoden' }
// 응답
{ photoTake, plans }
```

## 8. 롤아웃 5단계

원가: 생성 장당 40~60원. 코어당 3장 × 15 = 45장 + A/B 6장 = **51장 ≈ 3천원 미만**.
돈은 병목이 아니고 **시간이 병목**이다.

| 단계 | 내용 | 산출물 | 합격 기준 |
|---|---|---|---|
| 1 | 리팩터링 | `lib/core.ts`, `lib/photoTake.ts`, `config/cores/`, 재편된 `brief.ts` | **코케트 결과가 리팩터링 전과 동일** — 프롬프트 문자열 스냅샷 테스트 |
| 2 | 극단 3개 헌법 | `nuance` / `texture-gummy` / `decoden` | 타입 통과 |
| 3 | 실측 + A/B | `scripts/generate-core-candidates.mts`, 18장(3코어×3장×2조건), `attachPhoto` 확정 | 코어당 3장 중 1장 이상 "이 코어답다" |
| 4 | 나머지 확장 | 코어 파일 11개(코케트 제외) + 샘플 | 코어당 1장 이상 합격 |
| 5 | UI 조립 | 코어 선택 그리드 + `/api/analyze` `coreId` | 15장 전부 표시 |

**1단계의 유일한 합격 기준이 "코케트 회귀 0"인 이유**: 코케트는 유일하게 검증된 자산이다.
이걸 깨면 기준선을 잃고 이후 판단이 불가능해진다. 첫 작업은 현재 코케트 프롬프트
문자열을 스냅샷으로 고정하는 것이다 (`tests/prompt.test.ts`, `tests/api-analyze.test.ts` 확장).

**2단계에서 이 3개를 고른 이유**: 코케트에서 가장 먼 것들이다. 뉘앙스는 구조가 다르고
(레이어드 시어), 텍스처·구미는 파츠 없이 시끄럽고, 데코덴은 모든 전역 규칙의 반대다
(여백 0·파츠 10+). 조립기가 이 3개를 통과하면 중간 11개는 쉽다.

**순서를 지켜야 하는 이유**: 리팩터링 없이 헌법을 먼저 쓰면 넣을 곳이 없다.
눈에 보이는 결과(새 스타일 이미지)는 **3단계에서 처음 나온다.**

## 9. 이번 범위에서 제외 (YAGNI)

- **재생성 루프** — D8. judge는 점수만 기록
- **코어 자동 선택** — D9(업로드 전 선택)이므로 불필요
- **업로드 후 사후 제안** ("이 사진이면 OO 코어도 잘 맞아요") — 5단계 이후 별건
- **코어 조합** (데코덴 + 다크글램 동시 선택) — IMG_6259가 코어 3개 교집합이라
  후속 과제로 남지만, 지금은 단일 선택으로 시작

## 10. 출처

**트렌드 조사 (2026-08-06)**
- [The 7 non-negotiable nail trends for 2026 (Vogue Scandinavia)](https://www.voguescandinavia.com/articles/nail-trends-2026)
- [Nuance Nails — 도쿄 엑스포 85%](https://shopping.yahoo.com/beauty/nails/articles/nuance-nails-high-gloss-dimensional-210000181.html)
- [6 Nail Trends That Will Be Everywhere in 2026](https://www.aol.com/articles/6-nail-trends-everywhere-2026-170000138.html)
- [Pinterest Predicts 2026 — 3D tactile nails +180%](https://chicaesthetichub.com/35-stunning-3d-nail-ideas-for-2026-the-tactile-gimme-gummy-trend-taking-over-pinterest/)
- [Maximalist Nails 2026 — 텍스처 vs 풀장식](https://mirelleinspo.com/blog/maximalist-nails)
- [Maximalist Nails: 3D Art & Y2K Supply Guide](https://reforma.eu/blogs/news/maximalist-nails-y2k-3d-supply-list)
- [Mother-of-Pearl Nails at the 2026 Oscars](https://www.aol.com/articles/mother-pearl-nail-trend-everywhere-140200865.html)
- [Mermaid Nails Trend](https://www.aol.com/news/mermaid-nails-prettiest-summer-manicure-170000519.html)
- [Cherry Mocha Nail Trend 2026](https://www.beautycrew.com.au/cherry-mocha-nail-trend)
- [Nail Color Trends 2026 (Glamnetic)](https://www.glamnetic.com/blogs/news/best-nail-color-trends-in-2026)
- [Gyaru Nails / 데코덴 정의 (Gyaru Wiki)](https://gyaru-109.fandom.com/wiki/Gyaru_Nails)
- [Balletcore Nails (NewBeauty)](https://www.newbeauty.com/view/balletcore-nails)
- [Fairycore Nails](https://www.women.com/1537333/fairycore-nails-cottagecore-coquette-manicure-trends/)
- [Y2K Nails 2026 Guide](https://mirelleinspo.com/blog/y2k-nails/y2k-nails)
- [Clean Girl Nails 2026](https://velvetglowjournal.com/clean-girl-nails/)
- [2026년 가장 예쁜 여름 네일 19 (Vogue Korea)](https://www.vogue.co.kr/2026/06/24/손톱-위-작은-바다-2026년-가장-예쁜-여름-네일-19/)
- [2026 여름 네일 트렌드 총정리 (언니의파우치)](https://unpa.me/community/beautytip/130440530)
- [실버 네일 2026 트렌드 (코스모폴리탄 코리아)](https://www.cosmopolitan.co.kr/article/1906236)
- [갸루가 유행이라고요? (얼루어 코리아)](https://www.allurekorea.com/2026/08/06/갸루가-유행이라고요-요즘-갸루는-이것이-다릅니다)

**내부 자산**
- `ref/trendy/STYLE_ANALYSIS.md` — 코케트 코어 헌법의 근거 (수치 스펙 E절)
- `ref/PARTS_ANALYSIS.md` — 어휘 함정(`charm`→펜던트, `anchor`→⚓) 실측
- `ref/results/pilot-interpret/REPORT.md` — 텍스트 브리프만으로 충실도 90~95%
- `docs/api-variants-contract.md` — 변주 5종 계약
- `ref/trendy/IMG_6259.jpg` — 데코덴·다크글램·Y2K 교집합 참조 사진
