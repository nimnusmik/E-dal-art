# 갤러리 이미지 출처

랜딩의 "이런 시안이 나와요" 섹션에 싣는 4장. **전부 이 프로젝트가 실제로 생성하고
검수를 통과시킨 결과물**이다. 사용자가 올리는 영감 사진(`public/hero/insp/*`)을
여기 섞으면 섹션 문구가 거짓이 되므로 절대 금지 — 테스트로도 막아 뒀다
(`tests/landingContent.test.ts`).

| 파일 | 원본 | 판정 근거 |
|---|---|---|
| `celestial-gold.jpg` | `ref/results/pilot-judge/best-02.jpg` | vision 검수 **2장 모두 PASS (6/6)** — "금속 파츠가 단 하나의 네일에만 적용" 확인 (`pilot-judge/REPORT.md`) |
| `citrus.jpg` | `ref/results/pilot-judge/best-03.jpg` | vision 검수 **2장 모두 PASS** (`pilot-judge/REPORT.md`) |
| `dot-gingham.jpg` | `ref/results/pilot-coquette-v2/set-03.jpg` | 루브릭 **4/4 완전 통과** — "스티치 도트 깅엄 — 레퍼런스급. 최고작" (`pilot-coquette-v2/REPORT.md`) |
| `lilac-check.jpg` | `ref/results/pilot-coquette-v2/set-08.jpg` | 루브릭 **4/4 완전 통과** — "라일락 깅엄+장미 — 판매 가능 수준" (`pilot-coquette-v2/REPORT.md`) |

## 가공

- pilot-judge 2장: 폭 800px 리사이즈 + jpeg 품질 72 (`sips`)
- pilot-coquette-v2 2장: **우측 하단 UI 아이콘(음소거 표시)을 크롭으로 제거**한 뒤 동일 처리
  - `sips -c 1780 1780 --cropOffset 134 134` → 2048px 원본에서 우·하단 268px 제거
  - 이 배치의 생성물에는 소셜 UI 크롬이 함께 렌더되는 아티팩트가 있다. 다른 이미지를
    추가할 때도 우측 하단·상단을 반드시 확인할 것

## 원본 형식 관련

이 환경의 `sips`는 webp 출력을 지원하지 않아 jpeg로 저장했다. 용량을 더 줄이려면
`cwebp -q 78`로 재변환하고 `components/landing/content.ts`의 경로를 함께 바꾼다.
