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
 * 크론 비활성화됨 (2026-10-03): Vercel Hobby 플랜은 하루 1회 크론만 허용이라
 * vercel.json의 10분 크론이 배포를 막았다. reaper가 없으면 pending 마커와
 * 카운터는 KST 자정에 함께 만료되므로 최악의 경우 "크래시 난 요청의 쿼터가
 * 자정까지 미환불"이다. Pro 플랜이면 vercel.json에
 * 크론을 되살리면 된다. 인증은 CRON_SECRET Bearer.
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
