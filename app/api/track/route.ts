import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { METRIC_EVENTS, recordMetric, reserve, type MetricEvent } from '@/lib/quota';
import { clientIp } from '@/lib/request';

/**
 * save/evolve/share는 익명 카운터만 올린다.
 * notify는 한도 도달 화면의 알림 신청, price는 결과 화면의 유료 구독 버튼 클릭 —
 * 둘 다 **개인정보는 저장하지 않고** 카운터만 올린다. 개인정보를 보관하려면
 * 처리방침·동의 절차가 먼저 있어야 하므로, 지금은 수요 크기만 센다.
 */

/** 무인증 Redis 쓰기 엔드포인트라 IP당 캡을 둔다 — 없으면 플러딩으로 Upstash 커맨드 한도가 말라 서비스 전체가 멈춘다 */
const TRACK_LIMIT_PER_IP = 100;

function isTrackEvent(v: unknown): v is MetricEvent {
  return typeof v === 'string' && (METRIC_EVENTS as readonly string[]).includes(v);
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

  const store = getRedis();
  const now = new Date();
  const held = await reserve(
    store,
    // 'hero'·'variant'와 키 공간이 겹치지 않게 별도 접두사를 쓴다
    [{ key: `quota:track:${clientIp(req)}:${now.toISOString().slice(0, 10)}`, limit: TRACK_LIMIT_PER_IP, code: 'RATE_LIMIT' }],
    now,
  );
  if (!held.ok) return NextResponse.json({ ok: false }, { status: 429 });

  await recordMetric(store, event, now);
  return NextResponse.json({ ok: true });
}
