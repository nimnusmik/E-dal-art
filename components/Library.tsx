'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * 보관함 — 로그인한 사용자가 저장해 둔 시안.
 *
 * 이 화면이 로그인의 존재 이유다. 저장이 없던 동안에는 로그인해도 보여줄 것이 0개라
 * "혜택 없이 진입 마찰만 늘리는" 상태였다.
 *
 * 이미지 URL은 서명된 임시 주소라 약 1시간 뒤 만료된다. 탭을 오래 열어둔 뒤 깨진
 * 이미지를 보여주지 않도록, 실패하면 자리만 남기고 다시 불러올 수 있게 한다.
 */

interface SavedDesign {
  id: string;
  imageUrl: string;
  title: string;
  note: string | null;
  createdAt: string;
}

export default function Library({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const [designs, setDesigns] = useState<SavedDesign[] | null>(null); // null = 아직 안 불러옴
  const [busy, setBusy] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/designs');
      const json = (await res.json()) as { designs?: SavedDesign[] };
      const list = json.designs ?? [];
      setDesigns(list);
      setExpired(false);
      onCountChange?.(list.length);
    } catch {
      setDesigns([]);
    }
  }, [onCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (id: string) => {
    setBusy(id);
    try {
      await fetch(`/api/designs?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      setDesigns((prev) => {
        const next = (prev ?? []).filter((d) => d.id !== id);
        onCountChange?.(next.length);
        return next;
      });
    } finally {
      setBusy(null);
    }
  };

  if (designs === null) return null; // 첫 로드 중에는 자리를 만들지 않는다
  if (designs.length === 0) {
    return (
      <div className="library is-empty">
        <p className="assurance">
          Nothing saved yet. Make a set and tap &lsquo;Save to library&rsquo; to keep it here.
        </p>
      </div>
    );
  }

  return (
    <div className="library">
      <div className="library-head">
        <h2 className="overline">My Library</h2>
        <span className="assurance">{designs.length} saved</span>
      </div>

      {expired && (
        <p className="assurance library-expired" role="status">
          Image links expired.{' '}
          <button className="btn-link" onClick={() => void load()}>
            Reload
          </button>
        </p>
      )}

      <ul className="library-grid">
        {designs.map((d) => (
          <li key={d.id}>
            <figure className="library-card">
              {d.imageUrl ? (
                <img src={d.imageUrl} alt={d.title} onError={() => setExpired(true)} />
              ) : (
                <div className="library-missing" aria-hidden />
              )}
              <figcaption>
                <span className="library-title">{d.title}</span>
                {d.note && <span className="variant-note">{d.note}</span>}
              </figcaption>
              <button
                className="library-del"
                aria-label={`Delete ${d.title}`}
                disabled={busy === d.id}
                onClick={() => void remove(d.id)}
              >
                ✕
              </button>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
