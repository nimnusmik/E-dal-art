'use client';

import { useEffect, useState } from 'react';
import { drawCollage } from '@/lib/collage';
import type { GenerationResult, TrayPhoto } from '@/app/page';

async function base64ToBitmap(data: string, mimeType: string): Promise<ImageBitmap> {
  const res = await fetch(`data:${mimeType};base64,${data}`);
  return createImageBitmap(await res.blob());
}

async function urlToBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  return createImageBitmap(await res.blob());
}

function track(event: 'save' | 'evolve'): void {
  fetch('/api/track', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event }),
  }).catch(() => {});
}

export default function ResultScreen({
  result,
  photos,
  remaining,
  onEvolve,
  onRegenerate,
  onReset,
}: {
  result: GenerationResult;
  photos: TrayPhoto[];
  remaining: number | null;
  onEvolve: () => void;
  onRegenerate: () => void;
  onReset: () => void;
}) {
  const [collageUrl, setCollageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const nail = await base64ToBitmap(result.image, result.mimeType);
      const insets = await Promise.all(photos.map((p) => urlToBitmap(p.previewUrl)));
      const url = drawCollage(nail, insets);
      if (!cancelled) setCollageUrl(url);
    })().catch(() => {
      // 콜라주 합성 실패 시 원본 네일 이미지로 폴백
      if (!cancelled) setCollageUrl(`data:${result.mimeType};base64,${result.image}`);
    });
    return () => { cancelled = true; };
  }, [result, photos]);

  const save = () => {
    if (!collageUrl) return;
    track('save');
    const a = document.createElement('a');
    a.href = collageUrl;
    a.download = `idala-${Date.now()}.jpg`;
    a.click();
  };

  const evolve = () => {
    track('evolve');
    onEvolve();
  };

  return (
    <>
      {collageUrl ? (
        // 긴 눌러서 저장(iOS)도 되도록 img로 렌더
        <img className="result-img" src={collageUrl} alt="생성된 네일 디자인 콜라주" />
      ) : (
        <div className="generating"><div className="spinner" /></div>
      )}
      {result.mood && (
        <div className="mood-chips">
          {result.mood.keywords.map((k) => (
            <span className="chip" key={k}>{k}</span>
          ))}
          <span className="swatches">
            {result.mood.colors.slice(0, 3).map((c) => (
              <span className="swatch" key={c} style={{ background: c }} />
            ))}
          </span>
        </div>
      )}
      <div className="actions">
        <button className="btn btn-accent" onClick={save} disabled={!collageUrl}>
          이미지 저장
        </button>
        <button className="btn btn-primary" onClick={evolve}>
          사진 더하고 진화시키기
        </button>
        <button className="btn btn-ghost" onClick={onRegenerate}>
          다시 생성
        </button>
        <button className="btn btn-ghost" onClick={onReset}>
          새로 시작
        </button>
      </div>
      {remaining !== null && <p className="remaining">오늘 {remaining}회 남음</p>}
    </>
  );
}
