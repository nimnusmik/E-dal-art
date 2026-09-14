# 갤러리 이미지 출처

랜딩의 "이런 시안이 나와요" 섹션에 싣는 4장. **전부 이 프로젝트가 실제로 생성한 결과물**이다.
사용자가 올리는 영감 사진(`public/hero/insp/*`)을 여기 섞으면 섹션 문구가 거짓이 되므로
절대 금지 — 테스트로도 막아 뒀다 (`tests/landingContent.test.ts`).

선정은 2026-08-06 사용자가 후보 18장을 보고 직접 골랐다.

| 파일 | 원본 | 검수 상태 |
|---|---|---|
| `pastel-french.jpg` | `ref/results/pilot-judge/best-01.jpg` | ⚠️ **vision 검수 미통과** (케이스 01, 3회 시도 0통과) — 사용자가 외형을 보고 선택 |
| `sugar-dot.jpg` | `ref/results/pilot-lettering/set-01.jpg` | 레터링 파일럿 5/5 렌더링 성공분 |
| `blue-brown.jpg` | `ref/results/pilot-auto-interpret/set-01.jpg` | 분석 자동화 엔드투엔드, 자동 충실도 ~90% |
| `lilac-swirl.jpg` | `ref/results/pilot-coquette-v2/set-04.jpg` | **루브릭 4/4 완전 통과** — "톤온톤 양각 스월(젤 볼륨 기법 자발 등장)" |

## 알아둘 것 — 검수 미통과작이 섞여 있다

`pastel-french.jpg`는 vision 검수를 통과하지 못한 결과물이다(케이스 01, 3회 시도 0통과).
외형이 좋아 사용자가 직접 골랐다.

한때 `STATS`에 "100% · AI 검수 통과작만 노출"이라는 문구가 있어 이 이미지와 정면으로
충돌했으나, 그 카드는 이후 "0원 · 가입도 결제도 없이"로 교체되어 **현재는 불일치가 없다.**
앞으로 검수율을 내세우는 문구를 다시 넣는다면 이 이미지부터 교체해야 한다.

## 가공

- `pastel-french.jpg` — 워터마크 없음. 폭 800px 리사이즈 + jpeg 품질 72 (`sips`)
- `blue-brown.jpg`, `lilac-swirl.jpg` — 우·하단 UI 아이콘(음소거 표시)과 "1/2" 배지를
  크롭으로 제거: `sips -c 1780 1780 --cropOffset 134 134` (2048px 원본에서 우·하단 268px 제거)
- `sugar-dot.jpg` — 아이콘이 손톱과 같은 높이라 크롭하면 "Sugar" 레터링 줄이 잘린다.
  대신 **아이콘 영역만 주변 배경으로 메웠다**: 캔버스에서 어두운 덩어리의 경계 상자를
  자동 탐지(800px 기준 718,738–776,787) → 상자 좌우 바깥의 배경 픽셀을 행마다 읽어
  가로 보간으로 덮음. 배경이 매끈한 세로 그라데이션이라 이음매가 보이지 않는다.
  재현 스크립트는 커밋에 남기지 않았다 — 필요하면 같은 방식으로 다시 만들면 된다.

## 이 배치 생성물의 알려진 아티팩트

`pilot-coquette-v2`, `pilot-lettering`, `pilot-auto-interpret` 결과물에는 소셜 UI 크롬
(음소거 아이콘, "1/2" 페이지 배지)이 함께 렌더되는 경우가 있다. 새 이미지를 추가할 때
**우측 하단과 우측 상단을 반드시 확인할 것.** `pilot-judge` 결과물은 깨끗했다.

## 원본 형식 관련

이 환경의 `sips`는 webp 출력을 지원하지 않아 jpeg로 저장했다. 용량을 더 줄이려면
`cwebp -q 78`로 재변환하고 `components/landing/content.ts`의 경로를 함께 바꾼다.
