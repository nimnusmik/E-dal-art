import { NextResponse } from 'next/server';
import { deleteDesign, listDesigns, saveDesign, MAX_DESIGNS_PER_USER } from '@/lib/designs';
import { getRedis } from '@/lib/redis';
import { reserve, scopedQuotaKey } from '@/lib/quota';
import { DesignSaveBodySchema } from '@/lib/schemas';

/**
 * 보관함 — 로그인한 사용자의 시안 저장/조회/삭제.
 *
 * 이 라우트는 이미지를 **생성하지 않는다**. 이미 만들어진 결과물을 옮겨 담을 뿐이라
 * 생성 쿼터(비용 방어)와 무관하다. 대신 계정당 보관 수 상한 + 일일 저장 상한으로
 * 저장소(Blob — 무료가 아니다)를 지킨다.
 */

const SAVE_DAILY_LIMIT = 20; // 계정당 하루 저장 상한 — Blob 무료 1GB 방어

export const maxDuration = 30;

async function requireSub(): Promise<string | null> {
  try {
    const { auth } = await import('@/auth');
    const session = await auth();
    return session?.user?.id || null;
  } catch {
    return null;
  }
}

export async function GET(): Promise<NextResponse> {
  const sub = await requireSub();
  if (!sub) return NextResponse.json({ designs: [] });
  return NextResponse.json({ designs: await listDesigns(sub), max: MAX_DESIGNS_PER_USER });
}

export async function POST(req: Request): Promise<NextResponse> {
  const sub = await requireSub();
  if (!sub) return NextResponse.json({ error: 'LOGIN_REQUIRED' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const parsed = DesignSaveBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  const input = parsed.data;

  // Blob 저장소는 무료가 아니다 — 생성 쿼터와 별개로 계정당 일일 저장 상한을 건다
  const held = await reserve(
    getRedis(),
    [{ key: scopedQuotaKey('save', `u:${sub}`, new Date()), limit: SAVE_DAILY_LIMIT, code: 'RATE_LIMIT_SAVE' }],
    new Date(),
  );
  if (!held.ok) return NextResponse.json({ error: 'RATE_LIMIT_SAVE' }, { status: 429 });

  const result = await saveDesign({
    googleSub: sub,
    imageBase64: input.image,
    mimeType: input.mimeType,
    title: input.title.slice(0, 60),
    note: input.note?.slice(0, 60) ?? null,
    shape: input.shape ?? 'almond',
    length: input.length ?? 'medium',
    quality: input.quality ?? null,
    mood: input.mood ?? null,
  });

  if (result.ok) return NextResponse.json({ id: result.id });
  // 보관함이 꽉 찬 것은 사용자가 고칠 수 있는 상태라 구분해서 알린다
  await held.release(); // FULL·실패는 차감하지 않는다
  const status = result.reason === 'FULL' ? 409 : 500;
  return NextResponse.json({ error: result.reason }, { status });
}

export async function DELETE(req: Request): Promise<NextResponse> {
  const sub = await requireSub();
  if (!sub) return NextResponse.json({ error: 'LOGIN_REQUIRED' }, { status: 401 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  const ok = await deleteDesign(sub, id);
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 });
}
