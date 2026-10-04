import { NextResponse } from 'next/server';
import { currentAccountEmail, quotaSubject } from '@/lib/request';
import { creditsBySub } from '@/lib/payments';

/**
 * GET /api/access — 이용 상태 조회 (차감 없음).
 *
 * 예전 GET /api/analyze가 하던 "게이트 상태" 조회를 대체한다.
 * 랜딩·툴 카드가 페이월/로그인/생성 중 무엇을 보여줄지 이 하나로 결정한다.
 * 가격은 여기서 내려주지 않는다 — 화면이 lib/pricing 상수를 직접 쓴다.
 */

export async function GET(req: Request): Promise<NextResponse> {
  const subject = await quotaSubject(req);
  const credits = subject.startsWith('u:') ? await creditsBySub(subject.slice(2)) : 0;
  return NextResponse.json({
    paid: credits > 0, // 지금 생성할 수 있나 (남은 횟수 있음)
    remaining: credits, // 남은 횟수권
    email: await currentAccountEmail(),
  });
}
