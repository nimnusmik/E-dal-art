'use client';

import { useEffect, useState } from 'react';

/**
 * 이용 상태 (결제 게이트 + 잔여 횟수).
 *
 * 예전 useGate(초대 코드)를 대체한다. 히어로 배지·툴 카드·페이월이 같은 사실을
 * 말해야 하므로(결제 안 했는데 "하루 3회"라고 적혀 있으면 거짓말이 된다)
 * 한 번만 불러 공유한다. 모듈 레벨 캐시라 컴포넌트가 몇 개든 네트워크 요청은 1회다.
 */
export interface AccessState {
  /** 이용권 보유 여부 */
  paid: boolean;
  remaining: number | null;
  /** 로그인한 계정의 이메일. 비로그인이면 null */
  email: string | null;
  /** 얼리버드 남은 수량. 알 수 없으면 null (그때는 얼리버드가를 보여주지 않는다) */
  earlyBirdLeft: number | null;
  priceRegular: number;
  priceEarly: number;
}

const UNKNOWN: AccessState = {
  paid: false,
  remaining: null,
  email: null,
  earlyBirdLeft: null,
  priceRegular: 9900,
  priceEarly: 4900,
};

let cached: Promise<AccessState> | null = null;

export function fetchAccess(): Promise<AccessState> {
  if (!cached) {
    cached = fetch('/api/access')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Partial<AccessState> | null) =>
        j
          ? {
              paid: j.paid === true,
              remaining: typeof j.remaining === 'number' ? j.remaining : null,
              email: typeof j.email === 'string' ? j.email : null,
              earlyBirdLeft:
                typeof j.earlyBirdLeft === 'number' ? j.earlyBirdLeft : null,
              priceRegular:
                typeof j.priceRegular === 'number' ? j.priceRegular : 9900,
              priceEarly: typeof j.priceEarly === 'number' ? j.priceEarly : 4900,
            }
          : UNKNOWN,
      )
      .catch(() => UNKNOWN); // 표시용이라 실패는 조용히 넘긴다
  }
  return cached;
}

/**
 * 접근 상태 캐시 무효화 — 로그인/로그아웃·결제 완료 같이 상태가
 * 바뀔 수 있는 사건 뒤에 호출한다. 다음 fetchAccess()가 서버를 다시 묻는다.
 */
export function resetAccessCache(): void {
  cached = null;
}

/** 접근 상태가 도착할 때까지는 UNKNOWN(미결제)으로 둔다 — 깜빡임보다 낫다 */
export function useAccess(): AccessState {
  const [state, setState] = useState<AccessState>(UNKNOWN);
  useEffect(() => {
    let alive = true;
    void fetchAccess().then((a) => {
      if (alive) setState(a);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
