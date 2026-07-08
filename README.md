# 이달아 (Idala)

영감 사진 1~3장을 올리면 이달의 네일 아트 시안을 콜라주로 만들어주는 모바일 웹앱.
스펙: `docs/superpowers/specs/2026-07-07-nailspo-design.md`

## 개발 환경

```bash
cp .env.example .env.local   # 키 채우기
npm install
npm run dev                  # http://localhost:3000
npm test                     # Vitest
npm run typecheck
```

## 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `IMAGE_PROVIDER` | 이미지 생성 공급자: `gemini` 또는 `seedream` | `gemini` |
| `GEMINI_API_KEY` | Google AI Studio에서 발급 (`IMAGE_PROVIDER=gemini`일 때 필수) | (필수) |
| `GEMINI_IMAGE_MODEL` | 이미지 모델 ID. 품질 부족 시 `gemini-3-pro-image`로 승격 | `gemini-3.1-flash-image` |
| `SEEDREAM_API_KEY` | BytePlus ModelArk API 키 (`IMAGE_PROVIDER=seedream`일 때 필수) | (없음) |
| `SEEDREAM_MODEL` | Seedream 모델 ID. ModelArk 콘솔에서 확인 | `seedream-4-0` |
| `SEEDREAM_BASE_URL` | ModelArk 리전 엔드포인트 | `https://ark.ap-southeast.bytepluses.com/api/v3` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis (무료 플랜) | (필수) |
| `DAILY_USER_LIMIT` | IP당 하루 생성 횟수(요청 기준) | `3` |
| `DAILY_TOTAL_LIMIT` | 서비스 전체 하루 총량(요청 기준) | `200` |
| `TREND_KEYWORDS` | 쉼표 구분 트렌드 키워드. 비우면 `config/trends.ts` 기본값 | (없음) |
| `GEMINI_MOCK` / `SEEDREAM_MOCK` | `1`이면 해당 공급자 호출 없이 `ref/` 샘플 이미지로 목 응답. API 결제 전 전체 흐름 확인용 (로컬 전용) | (없음) |

> **공급자 차이**: Gemini는 무드 키워드+색상을 함께 반환하지만, Seedream은 이미지만 반환합니다. Seedream 사용 시 무드 칩의 색상 스와치는 생성된 이미지에서 자동 추출하며(키워드는 표시 안 함), 영감 사진은 BytePlus(해외 리전)로 전송되므로 개인정보 처리방침에 반영이 필요합니다.

> **결과 구성 & 비용**: 요청 1회당 이미지 2장을 병렬 생성합니다 — (1) 손 착용샷 콜라주(히어로), (2) 개별 네일 팁 10종이 담긴 플랫레이 세트(레퍼런스식). 즉 하루 총 이미지 수 = `DAILY_TOTAL_LIMIT × 2`. 팁 세트 생성이 실패해도 히어로만 있으면 성공으로 처리하며, 하루 횟수는 요청당 1회만 차감됩니다.

## 배포 (Vercel)

1. Upstash에서 Redis DB 생성 → REST URL/토큰 확보
2. Vercel 프로젝트 생성, 위 환경 변수 전부 등록
3. `git push` → 자동 배포

## 지표 확인

Upstash 콘솔에서 키 조회: `quota:total:YYYYMMDD`(일별 생성), `metric:save:YYYYMMDD`(저장 클릭), `metric:evolve:YYYYMMDD`(진화 클릭). 방문 지표는 Vercel Analytics.
`/api/track`은 인증이 없어 직접 호출로 카운터를 부풀릴 수 있으므로, save/evolve 지표는 정확한 값이 아닌 방향성 참고 지표로 취급할 것.

## 트렌드 갱신 (시즌마다)

`config/trends.ts`의 `DEFAULT_TREND_KEYWORDS` 수정 또는 Vercel 환경 변수 `TREND_KEYWORDS` 교체 후 재배포.
