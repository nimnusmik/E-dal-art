import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis';
import { recordMetric } from '@/lib/quota';

export async function POST(req: Request): Promise<NextResponse> {
  let event: unknown;
  try {
    ({ event } = await req.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (event !== 'save' && event !== 'evolve') {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  await recordMetric(getRedis(), event, new Date());
  return NextResponse.json({ ok: true });
}
