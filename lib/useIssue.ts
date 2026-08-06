'use client';

import { useEffect, useState } from 'react';
import { currentIssue, type Issue } from '@/lib/issue';

/**
 * 발행호를 마운트 이후 현재 값으로 교정하는 훅.
 *
 * `/`는 정적 프리렌더되므로 HTML에는 빌드 시각의 발행호가 박힌다.
 * 렌더 지점의 `suppressHydrationWarning`은 경고만 끄는 게 아니라 서버가 구운
 * 텍스트를 그대로 고정시켜서, 달이 바뀌어도 재배포 전까지 옛 호가 남는다.
 *
 * 마운트 직후 `currentIssue()`를 다시 호출해 상태를 갱신한다. 매 호출이 새 객체를
 * 반환하므로 값이 같아도 참조가 달라 리렌더가 한 번 보장되고, 그 리렌더에서 React가
 * 구워진 텍스트를 현재 값으로 덮어쓴다.
 */
export function useIssue(): Issue {
  const [issue, setIssue] = useState(currentIssue);
  useEffect(() => {
    setIssue(currentIssue());
  }, []);
  return issue;
}
