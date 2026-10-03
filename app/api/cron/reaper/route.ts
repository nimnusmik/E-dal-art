import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { sweepStalePending } from '@/lib/quota';

/**
 * GET /api/cron/reaper — 크래시로 환불되지 못한 쿼터 회수.
 *
 * 플랫폼 타임아웃(maxDuration 초과)/OOM은 라우트의 catch를 타지 않아
 * reserve()의 release()에 도달하지 못한다. reserve(trackPending: true)가
 * 남긴 pending 마커 중 TTL(기본 10분)을 넘긴 것을 여기서 환불한다.
 *
 * vercel.json의 Cron이 10분 간격으로 호출한다. 인증은 CRON_SECRET Bearer.
 * (Vercel Hobby 플랜은 Cron 실행 횟수에 제한이 있으니 플랜에 맞게 주기를 조정할 것)
 */

export const maxDuration = 60;

export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }
  try {
    const swept = await sweepStalePending(getRedis());
    return NextResponse.json({ swept });
  } catch {
    return NextResponse.json({ error: 'REAPER_FAILED' }, { status: 500 });
  }
}
