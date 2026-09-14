import { put, del, issueSignedToken, presignUrl } from '@vercel/blob';
import { getDb } from './db';
import { accountIdBySub } from './accounts';

/**
 * 보관한 시안 (Postgres 메타 + Blob 이미지).
 *
 * 왜 두 곳에 나눠 담나: base64 이미지 한 장이 300~800KB라 Postgres 무료 티어 0.5GB가
 * 600장에 찬다. 이미지는 오브젝트 스토리지에, 검색·정렬할 것만 DB에 둔다.
 *
 * Blob 스토어는 **private**이다. 계정에 묶인 사용자 콘텐츠를 "URL만 알면 누구나"
 * 볼 수 있는 상태로 두지 않는다. 대신 목록을 만들 때 사용자 폴더 하나로 스코프된 토큰을
 * 1회 발급하고, 각 항목의 서명 URL은 그 토큰으로 로컬에서 만든다 — 항목 수와 무관하게
 * 네트워크 호출은 1회다.
 */

export interface SavedDesign {
  id: string;
  /** 서명된 임시 조회 URL (목록 조회 시점에 발급) */
  imageUrl: string;
  title: string;
  note: string | null;
  shape: string;
  length: string;
  quality: unknown;
  mood: unknown;
  createdAt: string;
}

/** 서명 URL 수명. 페이지를 열어둔 채 한참 뒤 스크롤해도 끊기지 않을 만큼 */
const SIGNED_TTL_MS = 60 * 60 * 1000;

/** 보관함 상한 — 무료 티어를 지키는 선. 넘으면 오래된 것부터 지우게 안내한다 */
export const MAX_DESIGNS_PER_USER = 60;

export interface SaveDesignInput {
  googleSub: string;
  /** base64 (data: 접두사 없이) */
  imageBase64: string;
  mimeType: string;
  title: string;
  note?: string | null;
  shape: string;
  length: string;
  quality?: unknown;
  mood?: unknown;
}

export type SaveResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'NO_DB' | 'NO_ACCOUNT' | 'FULL' | 'FAILED' };

/**
 * 시안 1장을 보관함에 넣는다.
 * 업로드는 성공했는데 DB 기록이 실패하면 고아 blob이 남으므로, 그 경우 업로드를 되돌린다.
 */
export async function saveDesign(input: SaveDesignInput): Promise<SaveResult> {
  const sql = getDb();
  if (!sql) return { ok: false, reason: 'NO_DB' };

  const userId = await accountIdBySub(input.googleSub);
  if (!userId) return { ok: false, reason: 'NO_ACCOUNT' };

  const count = await countDesigns(userId);
  if (count >= MAX_DESIGNS_PER_USER) return { ok: false, reason: 'FULL' };

  const ext = input.mimeType.includes('png') ? 'png' : 'jpg';
  const pathname = `designs/${userId}/${crypto.randomUUID()}.${ext}`;
  const bytes = Buffer.from(input.imageBase64, 'base64');

  let uploaded = false;
  try {
    await put(pathname, bytes, {
      access: 'private',
      contentType: input.mimeType,
      addRandomSuffix: false,
    });
    uploaded = true;

    const rows = (await sql`
      insert into designs (user_id, image_path, title, note, shape, length, quality, mood)
      values (
        ${userId}, ${pathname}, ${input.title}, ${input.note ?? null},
        ${input.shape}, ${input.length},
        ${JSON.stringify(input.quality ?? null)}::jsonb,
        ${JSON.stringify(input.mood ?? null)}::jsonb
      )
      returning id
    `) as Array<{ id: string }>;

    const id = rows[0]?.id;
    if (!id) throw new Error('insert returned no id');
    return { ok: true, id };
  } catch {
    if (uploaded) await del(pathname).catch(() => {});
    return { ok: false, reason: 'FAILED' };
  }
}

/** 내 보관함 목록 (최신순) */
export async function listDesigns(googleSub: string): Promise<SavedDesign[]> {
  const sql = getDb();
  if (!sql) return [];
  const userId = await accountIdBySub(googleSub);
  if (!userId) return [];

  try {
    const rows = (await sql`
      select id, image_path, title, note, shape, length, quality, mood, created_at
      from designs
      where user_id = ${userId}
      order by created_at desc
      limit ${MAX_DESIGNS_PER_USER}
    `) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];

    const sign = await signerFor(userId);
    return await Promise.all(
      rows.map(async (r) => ({
      id: String(r.id),
      imageUrl: await sign(String(r.image_path)),
      title: String(r.title),
      note: r.note === null || r.note === undefined ? null : String(r.note),
      shape: String(r.shape),
      length: String(r.length),
      quality: r.quality ?? null,
      mood: r.mood ?? null,
      createdAt: new Date(String(r.created_at)).toISOString(),
      })),
    );
  } catch {
    return [];
  }
}

/** 보관함에서 1장 삭제. 소유자 조건을 쿼리에 넣어 남의 것을 지울 수 없게 한다 */
export async function deleteDesign(googleSub: string, designId: string): Promise<boolean> {
  const sql = getDb();
  if (!sql) return false;
  const userId = await accountIdBySub(googleSub);
  if (!userId) return false;

  try {
    const rows = (await sql`
      delete from designs
      where id = ${designId} and user_id = ${userId}
      returning image_path
    `) as Array<{ image_path: string }>;
    const path = rows[0]?.image_path;
    if (!path) return false; // 없거나 남의 것
    await del(path).catch(() => {}); // 이미지 삭제 실패는 고아 blob만 남길 뿐 치명적이지 않다
    return true;
  } catch {
    return false;
  }
}

async function countDesigns(userId: string): Promise<number> {
  const sql = getDb();
  if (!sql) return 0;
  const rows = (await sql`
    select count(*)::int as n from designs where user_id = ${userId}
  `) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

/**
 * 이 사용자 폴더로 스코프된 서명자를 만든다.
 *
 * 토큰 발급(issueSignedToken)만 네트워크 호출이고 목록당 1회다. 개별 URL 서명은
 * 그 토큰으로 하는 HMAC 계산이라 항목이 몇 개든 추가 왕복이 없다.
 */
async function signerFor(userId: string): Promise<(pathname: string) => Promise<string>> {
  const validUntil = Date.now() + SIGNED_TTL_MS;
  try {
    const token = await issueSignedToken({
      pathname: `designs/${userId}/*`,
      operations: ['get'],
      validUntil,
    });
    return async (pathname: string) => {
      try {
        const { presignedUrl } = await presignUrl(token, {
          operation: 'get',
          access: 'private',
          pathname,
          validUntil,
        });
        return presignedUrl;
      } catch {
        return '';
      }
    };
  } catch {
    // 서명 실패 시 빈 문자열 — UI는 이미지 없는 카드로 처리한다(깨진 이미지보다 낫다)
    return async () => '';
  }
}
