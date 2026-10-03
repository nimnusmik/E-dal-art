# 견적 도우미 (Quote Helper) 설계 — 2026-09-22

## 1. 왜 만드나

- 기존 이달아(영감 사진 → AI 시안 이미지)는 아티스트에게 "AI 이미지 = 재현 불가, 스트레스"라는 부정 신호가 있음 (Atlantic Nail Art Studio 블로그 2026-01, TikTok AI 네일 트렌드).
- 반면 아티스트가 매일 반복하는 일은 **"How much for this?" DM에 견적 답하기** — 예약 전 inspo 사진을 받아 난이도 등급으로 가격을 매기는 관행이 널리 퍼져 있음 (Airbnb 네일 서비스 등급가 $25/$35/$50 등).
- 원칙: "사람이 해야 할 판단(가격)은 사람이, 반복 가능한 것(사진 분류·답장 작성)은 AI가."

## 2. 무엇을 검증하나 (이 기능의 존재 이유)

이 페이지는 **판매가 아니라 검증 도구**다. F-1 신분이므로 결제 없음.

| 지표 | 의미 | 수집 |
|---|---|---|
| `quote` | 사진 올려 견적 받음 (써봄) | `/api/track` |
| `copy` | 답장 문구 복사 (실제 업무에 씀 — 핵심 지표) | `/api/track` |
| 대기자 이메일 | 정식 버전 원함 + 후속 연락 가능 | `waitlist` 테이블 |

**킬/고 기준 (사전 합의 필요):** 방문 아티스트 30명 기준 `copy` 전환율 20% 미만이고 대기자 3명 미만 → 접는다. 수치는 시장성 조사 후 확정.

## 3. 사용자와 범위

- 대상: 영어권 1인/독립 네일 아티스트 (홈샵·출장·부스 렌트). 화면 전부 영어.
- **포함:** `/quote` 페이지, AI 판정, 가격 계산, 답장 문구, 대기자 이메일(+도시).
- **제외 (반응 확인 후):** 로그인, 가격표 서버 저장, 손님용 링크, 결제, 마켓플레이스.
- 2단계 구상(이번 범위 아님): 가격표·도시 데이터가 한 도시에 모이면 손님용 "근처 아티스트 + 예상 가격". 이번에 도시 칸을 넣는 이유가 이것.

## 4. 화면 흐름 (`/quote`, 영어)

1. **가격표** — 처음 한 번, `localStorage` 저장. 예시 값 미리 채움.
   - 등급가 3칸: Simple / Detailed / Complex (기본 $25 / $35 / $50)
   - 파츠 1개당 요금 (기본 $3)
   - 기본 시술비 (선택, 비우면 아트비만)
2. **손님 사진** — 기존 `InspirationTray` 재사용, 최대 3장 → "Get quote".
3. **결과**
   - 판정 카드: 등급 · 파츠 수 · 예상 시간 · 그대로 가능/조정 필요 + 조정 메모 · AI 이미지 경고
   - 가격 내역: `$35 + 4 studs × $3 = $47` (코드 계산)
   - 답장 문구 2~3문장 + **[Copy reply]**
   - 등급·파츠 수를 아티스트가 직접 수정 가능 → 즉시 재계산 (AI 오판을 사람이 바로잡음)
   - 하단: 정식 버전 알림 이메일 + 도시(선택) + 동의 문구
4. 랜딩 연결: 링크 한 줄 "For nail techs: quote any inspo photo in seconds →"

## 5. 구성 요소

**원칙: AI는 판단만, 숫자와 문장은 코드가.** 가격을 LLM이 계산하면 숫자를 지어낼 수 있고, 견적에서 틀린 숫자는 신뢰를 즉시 깬다.

| 단위 | 역할 | 의존 |
|---|---|---|
| `lib/quote.ts` `analyzeQuote(images)` | 사진 → `QuoteJudgement` (Gemini, JSON 스키마 강제) | `@google/genai`, `isMock()` |
| `lib/quote.ts` `parseQuoteJudgement(text)` | 스키마 검증·클램프, 위반 시 null | — |
| `lib/quote.ts` `computeQuote(j, table)` | 순수 함수, 가격 내역·합계 | — |
| `lib/quote.ts` `buildReply(j, quote)` | 순수 함수, 영어 답장 템플릿 | — |
| `app/api/quote/route.ts` | POST 사진 → 판정. 초대 코드 없음, IP 20회/일 + 전역 상한, 실패 시 미차감 | `reserve()`, `parseImages()` |
| `app/api/waitlist/route.ts` | POST 이메일·도시 → Neon `waitlist` | `lib/db.ts` |
| `app/quote/page.tsx` + 컴포넌트 | 화면. 계산은 클라이언트에서 | 위 순수 함수 |

```ts
interface QuoteJudgement {
  tier: 'simple' | 'detailed' | 'complex';
  partsCount: number;          // 0~40 클램프
  minutes: [number, number];   // 예상 시술 시간 범위
  buildable: 'as-is' | 'adjust';
  adjustNotes: string[];       // 영어, 예: "3D bow → flat stud"
  looksAiGenerated: boolean;
}
```

**등급 기준 (판정 지시문에 명시, 이후 튜닝 대상):**

| 등급 | 기준 |
|---|---|
| Simple | 단색·프렌치·크롬, 단순 도트/라인이 일부 손톱에만 |
| Detailed | 손그림 3~5개 손톱, 소량 파츠 |
| Complex | 전 손톱 손그림, 3D 젤, 파츠 다량, 캐릭터 |

- 기존 `NailBrief` 재사용 안 함 — 생성 프롬프트용 한국어 구조라 목적이 다름. 호출 패턴(응답 스키마·1회 재시도)만 가져옴.
- 지표: `METRIC_EVENTS`에 `quote`, `copy` 추가.
- DB: `waitlist(id, email unique, city null, source, created_at)` — `db:setup`에 추가. `/privacy`에 수집 항목·목적·국외 이전 반영.
- Seedream 키 불필요. Gemini 텍스트 모델만 사용 (2026-09-22 키 정상 확인). 판정 1회 약 1원 [추정].

## 6. 오류 처리

- 입력 불량 400, 한도 429 (`RATE_LIMIT_QUOTE`), 분석 실패 502 + 한도 환불.
- 판정 실패 시 화면: "Couldn't read this photo — pick the tier yourself" + 수동 등급 선택으로 계산은 계속 가능.
- 사진이 네일이 아니면 모델이 판정 거부 → 동일 처리.
- 이메일 중복은 성공으로 응답 (존재 여부 노출 안 함).

## 7. 테스트와 검증

1. **단위 테스트:** `computeQuote`(기본비 유무·파츠 0·수정 반영), `buildReply`(조정 필요/AI 경고 문구 포함 여부), `parseQuoteJudgement`(스키마 위반·클램프).
2. **라우트 테스트:** 기존 `tests/api-*.test.ts` 패턴 — 한도·실패 환불·목 모드.
3. **판정 품질 시험지:** `ref/` 영감 사진 10장을 `analyzeQuote`에 넣어 등급·파츠 수를 사람 눈과 비교 (비용 수십 원). 등급 일치 8/10 미만이면 기준표부터 다듬는다.
4. **목 모드 브라우저 E2E:** 가격표 → 사진 → 결과 → 등급 수정 → 복사 → 이메일.

## 8. 시장성 — 판정: 만들지 않는다 (2026-09-22, 에이전트 3인 수렴)

| 조사 | 결론 |
|---|---|
| 시장 규모·경쟁 | 4/10. 실제 대상 2~4만 명 [추정], 매출 상한 연 $22~43만 [추정]. **거의 동일 제품 다수 존재** |
| 아티스트 목소리 34건 | 비타민급(신뢰도 중간). 견적 고통은 주로 초보자, 가격표 만들면 사라짐. AI 이미지는 "기대치 조율" 문제로 말하지 가격 문제로 말하지 않음 |
| 반대 검토 | NO-GO. 치명 가정 3개 깨질 확률 50~65% [추정], 무료 대체재(Custom GPT) 방어력 없음, 마켓플레이스 확장 논리 불성립 |

기존 경쟁 제품 (직접 확인: Lacqr):
- [Lacqr](https://lacqr.io/) — 사진 분석(길이·모양·크롬·3D) + 아티스트 가격표 + 견적 링크 + AI 시안. 무료 10회 / $15 / $99
- [NailPriceAI](https://nailpriceai.com) $4.99/월, [Christine Helps](https://christinehelps.com) DM 자동응답 $29/월, [Gelpik](https://gelpik.com) €8/월~, [NailScan](https://nailscan.app)
- 이들에 대한 실사용 후기도 찾지 못함 → 수요 자체가 약하다는 신호 가능

남은 빈자리 1개: "AI 시안 판별 + 정중한 대안 답장" — 단, 가격 고통과 연결된 증거 0건.

**결론:** 이 설계는 구현하지 않는다. 계속하려면 코드 0줄 컨시어지 실험(영어권 1인 아티스트 30명에게 DM으로 무료 견적 대행 제안, 2주, 답장 3명 미만이면 폐기)을 먼저 통과해야 한다.

## 9. 열린 질문

- 킬/고 기준 수치 확정.
- 아티스트 유입 경로 (r/Nailtechs 소개 글 등) — 창업자가 직접 해야 하는 유일한 단계.
