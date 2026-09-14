'use client';

import { useEffect, useState } from 'react';
import { inviteHeaders } from './invite';

/**
 * 초대 게이트 + 잔여 횟수 조회 결과.
 *
 * 히어로 배지와 툴 카드가 같은 사실을 말해야 하므로(게이트가 켜져 있는데 "하루 3회 무료"라고
 * 적혀 있으면 거짓말이 된다) 한 번만 불러 공유한다. 모듈 레벨 캐시라 컴포넌트가 몇 개든
 * 네트워크 요청은 1회다.
 */
export interface GateState {
  remaining: number | null;
  inviteRequired: boolean;
  hasInvite: boolean;
  /** 로그인한 계정의 이메일. 비로그인이면 null */
  email: string | null;
}

const UNKNOWN: GateState = { remaining: null, inviteRequired: false, hasInvite: true, email: null };

let cached: Promise<GateState> | null = null;

export function fetchGate(): Promise<GateState> {
  if (!cached) {
    cached = fetch('/api/analyze', { headers: inviteHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Partial<GateState> | null) =>
        j
          ? {
              remaining: typeof j.remaining === 'number' ? j.remaining : null,
              inviteRequired: j.inviteRequired === true,
              hasInvite: j.hasInvite === true,
              email: typeof j.email === 'string' ? j.email : null,
            }
          : UNKNOWN,
      )
      .catch(() => UNKNOWN); // 표시용이라 실패는 조용히 넘긴다
  }
  return cached;
}

/** 게이트 상태가 도착할 때까지는 UNKNOWN(게이트 없음)으로 둔다 — 깜빡임보다 낫다 */
export function useGate(): GateState {
  const [state, setState] = useState<GateState>(UNKNOWN);
  useEffect(() => {
    let alive = true;
    void fetchGate().then((g) => {
      if (alive) setState(g);
    });
    return () => {
      alive = false;
    };
  }, []);
  return state;
}
