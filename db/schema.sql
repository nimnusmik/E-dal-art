-- 이달아 스키마 (Neon Postgres)
--
-- 설계 규칙 세 가지:
--  1. 카드번호·생년월일·주민번호는 절대 들어오지 않는다. 결제가 생기면 PG사에 위임하고
--     우리는 provider_ref 문자열만 보관한다. 이 원칙 하나로 사고 범위가 크게 줄어든다.
--  2. 이미지 바이트는 여기 넣지 않는다. base64 한 장이 300~800KB라 무료 티어 0.5GB가
--     600장에 찬다. 이미지는 오브젝트 스토리지에 두고 URL만 기록한다.
--  3. 탈퇴는 즉시 완전 삭제(hard delete). 유예기간을 둘 만큼 복구 요구가 없고,
--     "지웠다"는 약속을 문자 그대로 지키는 쪽이 처리방침과 일치한다.
--
-- 적용: psql "$DATABASE_URL" -f db/schema.sql  (또는 npm run db:setup)
-- 모든 문장은 멱등이라 여러 번 실행해도 안전하다.

create extension if not exists "pgcrypto";

-- ─── 계정 ────────────────────────────────────────────────────────
-- 세션 테이블은 두지 않는다. Auth.js를 JWT 전략으로 쓰므로 세션은 쿠키 안에 있고,
-- 이 테이블은 "누가 가입했나"와 보관함 소유권만 담당한다.
create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  -- 구글 sub. 이메일은 바뀔 수 있으므로 이쪽을 계정의 기준으로 삼는다
  google_sub    text        not null unique,
  email         text        not null,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  -- 매달 발송 동의. 필수 동의와 분리된 별도 항목이다(정보통신망법)
  marketing_ok  boolean     not null default false
);

create index if not exists users_email_idx on users (email);

-- ─── 보관한 시안 ─────────────────────────────────────────────────
-- 로그인이 "빈 껍데기"를 벗어나는 지점. 재방문했을 때 보여줄 것이 여기 있다.
create table if not exists designs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid        not null references users(id) on delete cascade,
  -- 이미지 실체는 오브젝트 스토리지(비공개 Blob)에. 여기엔 경로만 —
  -- 조회 URL은 볼 때마다 짧게 사는 서명 URL로 새로 만든다
  image_path    text        not null,
  -- 카드에 표시할 것들 (생성 당시 값 그대로 — 나중에 프롬프트가 바뀌어도 기록은 불변)
  title         text        not null,
  note          text,
  shape         text        not null,
  length        text        not null,
  -- 검수 결과. 점수·심사평·미달 항목을 통째로 보관해 "왜 통과였나"를 나중에도 볼 수 있다
  quality       jsonb,
  -- 무드 키워드·색상 (상품 텍스트용)
  mood          jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists designs_user_created_idx on designs (user_id, created_at desc);
