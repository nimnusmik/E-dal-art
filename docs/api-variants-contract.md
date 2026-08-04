# API 계약: 5종 변주 파이프라인 (P1+P3) — 2026-08-04

> 백엔드·프론트 에이전트 공용 계약. 이 문서가 단일 진실이며, 변경 시 양쪽 합의 필요.
> 배경: 기존 POST /api/generate(팁셋 1개+착용샷 직렬, 50~70초)의 문제 —
> ① 너무 느림 ② 디자인 1개뿐 ③ 파츠·길이 자유도 없음.
> 새 구조: 분석 1회 → 5종 플랜 → 클라이언트가 variant 5개를 병렬 호출(완성순 표시)
> → 유저가 고른 것만 착용샷 온디맨드.

## 공통 타입

```ts
// lib/types.ts (백엔드 소유)
type PartsIntensity = 'auto' | 'none' | 'point' | 'rich';
// auto: 사진의 파츠 밀도 그대로 / none: 파츠 0 / point: 포인트 1~2개 / rich: 화려하게

interface VariantPlan {
  id: string;            // "v1"~"v5"
  title: string;         // 한국어 짧은 이름 (예: "도트 반전", "레이스 포인트") — UI 카드 라벨
  patternLines: string[]; // 베이스 브리프의 patternLines를 대체
  partsLine: string;      // 베이스 브리프의 partsLine을 대체
  letteringWord: string | null;
  paletteLine?: string;   // 없으면 베이스 브리프 것 사용
}
```

## POST /api/analyze

요청: `{ images: ImagePayload[1~3], shape: NailShape, length: NailLength, partsIntensity: PartsIntensity }`
응답 200: `{ brief: NailBrief, plans: VariantPlan[5], remaining: number }`
오류: 400 INVALID_INPUT / 429 RATE_LIMIT_USER·RATE_LIMIT_TOTAL / 502 ANALYZE_FAILED
쿼터: 성공 시 기존 일일 사용자 크레딧 1 차감 (세션 시작 = 1회).
동작: analyzeToBrief → shape/length/partsIntensity 오버라이드 적용 → planVariants(브리프→5플랜).

GET /api/analyze → 200 `{ remaining: number }` — 쿼터 조회만, 차감 없음 (기존 GET /api/generate와 동일 로직). 시작 화면의 남은 횟수 표시용.

## POST /api/variant

요청: `{ images: ImagePayload[1~3], brief: NailBrief, plan: VariantPlan }`
응답 200: `{ tipSet: { image: string; mimeType: string }, quality: { pass: boolean; score: number } | null }`
오류: 400 / 422 REJECTED / 429 RATE_LIMIT_VARIANT / 502 GENERATION_FAILED
쿼터: 별도 variant 일일 카운터 (상한 = DAILY_USER_LIMIT × 6). 성공 시에만 차감.
동작: plan을 브리프에 merge → 팁셋 1장 생성 + 검수 1회 (variant당 재시도 없음 —
5종 병렬이 곧 다양성이므로 낙제작은 quality.pass=false로 표시만).
프론트는 5개를 Promise 단위로 병렬 fetch → 완성순으로 카드 렌더.

## POST /api/hero

요청: `{ images: ImagePayload[1~3], tipSet: { image: string; mimeType: string }, shape: NailShape, length: NailLength }`
응답 200: `{ hero: { image: string; mimeType: string } }`
오류: 400 / 422 / 429 RATE_LIMIT_HERO / 502
쿼터: 별도 hero 일일 카운터 (상한 = DAILY_USER_LIMIT × 5). 성공 시에만 차감.
동작: 기존 buildPrompt(hasTipReference=true) 경로 재사용 — 팁셋 이미지를 참조로 손 착용샷 생성.

## 길이·파츠 규칙 (P3, 백엔드 구현)

- partsIntensity 오버라이드: none → zero-parts 문장 / point → 포인트 1~2개(S1/S4/S6 계열)
  / rich → 사진 밀도 그대로 상향 허용 / auto → 분석 결과 그대로.
- 길이 규칙(buildBriefPrompt에 length별 라인 추가):
  short → 팁 영역 20~30%로 축소, 마이크로 도트·얇은 라인 위주, 3D 센터피스·긴 레터링 금지(공간 없음)
  medium → 기존 스펙(30~45%)
  long → 딥프렌치·레터링·센터피스 모두 허용
- 프롬프트 어휘 규칙 준수: charm/anchor 금지, 부정문 대신 긍정문(기존 tests/brief.test.ts 회귀 테스트 있음).

## 하위 호환

기존 POST /api/generate는 그대로 유지 (레거시 클라이언트·폴백용). 프론트만 신규 3엔드포인트로 전환.
