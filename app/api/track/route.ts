import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { recordMetric } from '@/lib/quota';

/**
 * save/evolve/share는 익명 카운터만 올린다.
 * notify는 한도 도달 화면의 알림 신청 — 카운터만 올리고 **이메일은 저장하지 않는다.**
 * 개인정보를 보관하려면 처리방침·동의 절차가 먼저 있어야 하므로, 지금은 수요 크기만 센다.
 */
const EVENTS = ['save', 'evolve', 'share', 'notify'] as const;
type TrackEvent = (typeof EVENTS)[number];

function isTrackEvent(v: unknown): v is TrackEvent {
  return typeof v === 'string' && (EVENTS as readonly string[]).includes(v);
}

export async function POST(req: Request): Promise<NextResponse> {
  let event: unknown;
  try {
    ({ event } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!isTrackEvent(event)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await recordMetric(getRedis(), event, new Date());
  return NextResponse.json({ ok: true });
}
