'use client';

import { useEffect, useState } from 'react';
import VariantGrid from '@/components/VariantGrid';
import { drawCollage, extractColors } from '@/lib/collage';
import { currentIssue } from '@/lib/issue';
import type { HeroEntry, TrayPhoto, VariantSlot } from '@/app/page';
import type { Mood } from '@/lib/types';

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
  slots,
  selectedId,
  heroMap,
  mood,
  photos,
  remaining,
  onSelect,
  onRetry,
  onHero,
  onEvolve,
  onRegenerate,
  onReset,
}: {
  slots: VariantSlot[];
  selectedId: string | null;
  heroMap: Record<string, HeroEntry>;
  mood: Mood | null;
  photos: TrayPhoto[];
  remaining: number | null;
  onSelect: (planId: string) => void;
  onRetry: (planId: string) => void;
  onHero: (planId: string) => void;
  onEvolve: () => void;
  onRegenerate: () => void;
  onReset: () => void;
}) {
  const [collageUrl, setCollageUrl] = useState<string | null>(null);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const issue = currentIssue();

  const selected = slots.find((s) => s.plan.id === selectedId) ?? null;
  const selectedIndex = selected ? slots.indexOf(selected) : -1;
  const tipSet = selected?.tipSet ?? null;
  const tipSetUrl = tipSet ? `data:${tipSet.mimeType};base64,${tipSet.image}` : null;
  const hero = selected ? (heroMap[selected.plan.id] ?? null) : null;
  const stillDrawing = slots.some((s) => s.status === 'pending');

  // 착용샷이 도착하면 히어로 콜라주 합성 + (무드 색상 없으면) 색상 추출
  useEffect(() => {
    let cancelled = false;
    setCollageUrl(null);
    const heroImage = hero?.image;
    if (!heroImage) return;
    (async () => {
      const nail = await base64ToBitmap(heroImage.image, heroImage.mimeType);
      if (!cancelled && !mood?.colors?.length) {
        setExtractedColors(extractColors(nail, 3));
      }
      const insets = await Promise.all(photos.map((p) => urlToBitmap(p.previewUrl)));
      const url = drawCollage(nail, insets);
      if (!cancelled) setCollageUrl(url);
    })().catch(() => {
      // 콜라주 합성 실패 시 원본 착용샷 이미지로 폴백
      if (!cancelled) setCollageUrl(`data:${heroImage.mimeType};base64,${heroImage.image}`);
    });
    return () => { cancelled = true; };
  }, [hero, mood, photos]);

  const saveHero = () => {
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

  const keywords = mood?.keywords ?? [];
  const colors = mood?.colors?.length ? mood.colors : extractedColors;
  const hasAnyDone = slots.some((s) => s.status === 'done');

  return (
    <>
      {/* 선택된 시안 — 확대 보기 */}
      <div className="result-figure">
        <p className="overline" suppressHydrationWarning>
          Your Pick — {issue.monthLabel}
        </p>
        {selected && tipSetUrl ? (
          <>
            {/* 길게 눌러 저장(iOS)도 되도록 img로 렌더 */}
            <img
              className="result-img"
              src={tipSetUrl}
              alt={`선택한 네일 시안 — ${selected.plan.title}`}
            />
            <div className="pick-head">
              <h2 className="pick-title">
                {selectedIndex >= 0 && (
                  <span className="pick-no" aria-hidden>
                    {String(selectedIndex + 1).padStart(2, '0')}
                  </span>
                )}
                {selected.plan.title}
              </h2>
              {selected.quality?.pass === true && <span className="variant-badge">검수 통과</span>}
              {selected.quality?.pass === false && (
                <span className="variant-badge soft">아쉬운 컷</span>
              )}
            </div>
          </>
        ) : (
          <div className="blocked-card">
            <p className="sub">
              {hasAnyDone
                ? '아래에서 마음에 드는 시안을 골라주세요'
                : '완성된 시안이 없어요. 아래에서 다시 시도해주세요'}
            </p>
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

      {/* 착용샷 — 시안당 1회 온디맨드 생성, 결과는 캐시 */}
      {selected && tipSetUrl && (
        <div className="hero-block">
          {!hero && (
            <button className="btn-fill" onClick={() => onHero(selected.plan.id)}>
              이 시안 착용샷 보기
            </button>
          )}
          {hero?.status === 'loading' && (
            <div className="hero-loading" role="status" aria-live="polite">
              <p className="sub">손에 얹어보는 중...</p>
              <div className="progress-track" aria-hidden>
                <div className="progress-fill" />
              </div>
            </div>
          )}
          {hero?.status === 'done' &&
            (collageUrl ? (
              <img className="result-img" src={collageUrl} alt="생성된 네일 착용샷 콜라주" />
            ) : (
              <div className="result-loading" aria-hidden>
                <div className="progress-track">
                  <div className="progress-fill" />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 시안 5종 그리드 — 아직 그려지는 중이어도 완성분부터 갈아탈 수 있다 */}
      <div className="tipset-block">
        <p className="overline">Five Looks{stillDrawing ? ' — 그리는 중' : ''}</p>
        <VariantGrid slots={slots} selectedId={selectedId} onSelect={onSelect} onRetry={onRetry} />
      </div>

      {/* 버튼 위계: 핵심 루프(진화)를 프라이머리로, 저장 2종은 세컨더리, 나머지는 링크 */}
      <div className="actions">
        <button className="btn-fill" onClick={evolve}>
          사진 더해 시안 진화시키기
        </button>
        <div className="actions-row">
          <button className="btn-outline" onClick={saveHero} disabled={!collageUrl}>
            착용샷 저장
          </button>
          <button className="btn-outline" onClick={saveTipSet} disabled={!tipSetUrl}>
            팁셋 저장
          </button>
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
