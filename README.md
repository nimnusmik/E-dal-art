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
| `GEMINI_API_KEY` | Google AI Studio에서 발급 | (필수) |
| `GEMINI_IMAGE_MODEL` | 이미지 모델 ID. 품질 부족 시 `gemini-3-pro-image`로 승격 | `gemini-3.1-flash-image` |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis (무료 플랜) | (필수) |
| `DAILY_USER_LIMIT` | IP당 하루 생성 횟수 | `3` |
| `DAILY_TOTAL_LIMIT` | 서비스 전체 하루 총량 | `200` |
| `TREND_KEYWORDS` | 쉼표 구분 트렌드 키워드. 비우면 `config/trends.ts` 기본값 | (없음) |

## 배포 (Vercel)

1. Upstash에서 Redis DB 생성 → REST URL/토큰 확보
2. Vercel 프로젝트 생성, 위 환경 변수 전부 등록
3. `git push` → 자동 배포

## 지표 확인

Upstash 콘솔에서 키 조회: `quota:total:YYYYMMDD`(일별 생성), `metric:save:YYYYMMDD`(저장 클릭), `metric:evolve:YYYYMMDD`(진화 클릭). 방문 지표는 Vercel Analytics.
`/api/track`은 인증이 없어 직접 호출로 카운터를 부풀릴 수 있으므로, save/evolve 지표는 정확한 값이 아닌 방향성 참고 지표로 취급할 것.

## 트렌드 갱신 (시즌마다)

`config/trends.ts`의 `DEFAULT_TREND_KEYWORDS` 수정 또는 Vercel 환경 변수 `TREND_KEYWORDS` 교체 후 재배포.
