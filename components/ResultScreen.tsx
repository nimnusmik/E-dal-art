'use client';

import { useEffect, useState } from 'react';
import { drawCollage, extractColors } from '@/lib/collage';
import { currentIssue } from '@/lib/issue';
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

function downloadDataUrl(url: string, name: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
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
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const issue = currentIssue();

  const { hero, tipSet } = result;
  const tipSetUrl = tipSet ? `data:${tipSet.mimeType};base64,${tipSet.image}` : null;

  // 히어로 콜라주 합성 + (무드 색상 없으면) 색상 추출
  useEffect(() => {
    let cancelled = false;
    setCollageUrl(null);
    (async () => {
      const nail = await base64ToBitmap(hero.image, hero.mimeType);
      if (!cancelled && !result.mood?.colors?.length) {
        setExtractedColors(extractColors(nail, 3));
      }
      const insets = await Promise.all(photos.map((p) => urlToBitmap(p.previewUrl)));
      const url = drawCollage(nail, insets);
      if (!cancelled) setCollageUrl(url);
    })().catch(() => {
      // 콜라주 합성 실패 시 원본 네일 이미지로 폴백
      if (!cancelled) setCollageUrl(`data:${hero.mimeType};base64,${hero.image}`);
    });
    return () => { cancelled = true; };
  }, [hero, result.mood, photos]);

  const save = () => {
    if (!collageUrl) return;
    track('save');
    const ext = collageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    downloadDataUrl(collageUrl, `idala-${Date.now()}.${ext}`);
  };

  const saveTipSet = () => {
    if (!tipSetUrl) return;
    track('save');
    const ext = tipSetUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    downloadDataUrl(tipSetUrl, `idala-set-${Date.now()}.${ext}`);
  };

  const evolve = () => {
    track('evolve');
    onEvolve();
  };

  const keywords = result.mood?.keywords ?? [];
  const colors = result.mood?.colors?.length ? result.mood.colors : extractedColors;

  return (
    <>
      <div className="result-figure">
        <p className="overline" suppressHydrationWarning>
          Your Look — {issue.monthLabel}
        </p>
        {collageUrl ? (
          // 길게 눌러 저장(iOS)도 되도록 img로 렌더
          <img className="result-img" src={collageUrl} alt="생성된 네일 디자인 콜라주" />
        ) : (
          <div className="result-loading" aria-hidden>
            <div className="progress-track">
              <div className="progress-fill" />
            </div>
          </div>
        )}
      </div>

      {(keywords.length > 0 || colors.length > 0) && (
        <div className="mood-line">
          {/* 키워드가 없을 땐(색상 추출 모드) 스와치만 덩그러니 놓이지 않게 라벨을 붙인다 */}
          <span className="mood-keywords">
            {keywords.length > 0 ? keywords.join(' · ') : '이 시안의 컬러'}
          </span>
          {colors.length > 0 && (
            <span className="swatches">
              {colors.slice(0, 3).map((c, i) => (
                <span className="swatch" key={i} style={{ background: c }} />
              ))}
            </span>
          )}
        </div>
      )}

      {tipSetUrl && (
        <div className="tipset-block">
          <p className="overline">Your Tip Set — 10 Looks</p>
          <img className="tipset-img" src={tipSetUrl} alt="이달의 네일 디자인 10종 세트" />
        </div>
      )}

      {/* 버튼 위계: 핵심 루프(진화)를 프라이머리로, 저장 2종은 세컨더리, 나머지는 링크 */}
      <div className="actions">
        <button className="btn-fill" onClick={evolve}>
          사진 더해 시안 진화시키기
        </button>
        <div className="actions-row">
          <button className="btn-outline" onClick={save} disabled={!collageUrl}>
            착용샷 저장
          </button>
          {tipSetUrl && (
            <button className="btn-outline" onClick={saveTipSet}>
              팁 10종 저장
            </button>
          )}
        </div>
        <div className="actions-links">
          <button className="btn-link" onClick={onRegenerate}>
            다시 생성
          </button>
          <span aria-hidden>·</span>
          <button className="btn-link" onClick={onReset}>
            새로 시작
          </button>
        </div>
      </div>
      {remaining !== null && remaining <= 10 && (
        <p className="remaining">오늘 {remaining}회 남음</p>
      )}
    </>
  );
}
