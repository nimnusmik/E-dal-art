import { NextResponse } from 'next/server';
import { deleteDesign, listDesigns, saveDesign, MAX_DESIGNS_PER_USER } from '@/lib/designs';
import { MAX_IMAGE_BASE64_CHARS } from '@/lib/request';

/**
 * 보관함 — 로그인한 사용자의 시안 저장/조회/삭제.
 *
 * 이 라우트는 이미지를 **생성하지 않는다**. 이미 만들어진 결과물을 옮겨 담을 뿐이라
 * 생성 쿼터(비용 방어)와 무관하다. 대신 계정당 보관 수 상한으로 저장소를 지킨다.
 */

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

  const image = body.image;
  const mimeType = body.mimeType;
  const title = body.title;
  if (typeof image !== 'string' || image.length === 0 || image.length > MAX_IMAGE_BASE64_CHARS * 2) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  if (typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }
  if (typeof title !== 'string' || title.length === 0) {
    return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
  }

  const result = await saveDesign({
    googleSub: sub,
    imageBase64: image,
    mimeType,
    title: title.slice(0, 60),
    note: typeof body.note === 'string' ? body.note.slice(0, 60) : null,
    shape: typeof body.shape === 'string' ? body.shape : 'almond',
    length: typeof body.length === 'string' ? body.length : 'medium',
    quality: body.quality ?? null,
    mood: body.mood ?? null,
  });

  if (result.ok) return NextResponse.json({ id: result.id });
  // 보관함이 꽉 찬 것은 사용자가 고칠 수 있는 상태라 구분해서 알린다
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
