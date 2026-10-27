'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import OptionsPicker from '@/components/OptionsPicker';
import SaveToLibrary from '@/components/SaveToLibrary';
import { drawCollage, extractColors, extractVividColors } from '@/lib/collage';
import { currentIssue } from '@/lib/issue';
import type { GeneratedImage, HeroEntry, PartsIntensity, TrayPhoto, VariantSlot } from '@/app/page';
import type { Mood, NailLength, NailShape } from '@/lib/types';
import '@/app/studio.css';

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

async function base64ToBitmap(data: string, mimeType: string): Promise<ImageBitmap> {
  const res = await fetch(`data:${mimeType};base64,${data}`);
  return createImageBitmap(await res.blob());
}

async function urlToBitmap(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  return createImageBitmap(await res.blob());
}

function track(event: 'save' | 'evolve' | 'share'): void {
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
  // DOM에 붙지 않은 앵커의 click은 iOS Safari에서 무시된다 — 붙였다 떼낸다
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * iOS는 <a download>을 data: URL에 적용하지 않는다.
 * click만으로는 저장이 안 되니 새 탭으로 열어 '길게 눌러 저장'을 유도한다.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

async function dataUrlToFile(url: string, name: string): Promise<File> {
  const blob = await (await fetch(url)).blob();
  return new File([blob], name, { type: blob.type });
}

/**
 * 공유가 이 제품의 완료 조건이다 — "샵에 가져갈 사진이 생겨요"라는 약속의 실행 경로가
 * 파일 다운로드뿐이면 카톡으로 보내는 데 스크린샷을 찍게 된다.
 * Web Share(파일)를 우선하고, 미지원 브라우저는 다운로드로 폴백한다.
 */
async function shareOrDownload(url: string, name: string, text: string): Promise<'share' | 'download'> {
  try {
    const file = await dataUrlToFile(url, name);
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], text });
      return 'share';
    }
  } catch {
    // 사용자 취소 또는 미지원 — 폴백으로 넘어간다
  }
  if (isIOS()) {
    // iOS Safari는 download 속성을 무시해 click만으로 저장이 안 된다.
    // 새 탭으로 열어 시스템 공유 시트('이미지 저장')로 넘긴다.
    window.open(url, '_blank', 'noopener');
    return 'download';
  }
  downloadDataUrl(url, name);
  return 'download';
}

export default function ResultScreen({
  slots,
  selectedId,
  heroMap,
  mood,
  craft,
  heroError,
  signedIn,
  photos,
  remaining,
  shape,
  length,
  partsIntensity,
  onShape,
  onLength,
  onPartsIntensity,
  onSelect,
  onRetry,
  onHero,
  onTryOn,
  onEvolve,
  onRegenerate,
  onReset,
  restored = false,
}: {
  slots: VariantSlot[];
  selectedId: string | null;
  heroMap: Record<string, HeroEntry>;
  mood: Mood | null;
  /** 시술 난이도·조정 메모 — 분석이 이미 만든 한국어 자산 */
  craft: { difficulty: string; notes: string } | null;
  /** 착용샷 실패 사유 — 사라지지 않는 인라인 안내로 표시한다 */
  heroError: string | null;
  /** 로그인 상태면 보관함 저장 버튼을 띄운다 */
  signedIn: boolean;
  photos: TrayPhoto[];
  remaining: number | null;
  shape: NailShape;
  length: NailLength;
  partsIntensity: PartsIntensity;
  onShape: (s: NailShape) => void;
  onLength: (l: NailLength) => void;
  onPartsIntensity: (p: PartsIntensity) => void;
  onSelect: (planId: string) => void;
  onRetry: (planId: string) => void;
  onHero: (planId: string) => void;
  /** 내 손 사진에 입혀보기 (SAM + Muse Image) */
  onTryOn: (planId: string, file: File) => Promise<GeneratedImage>;
  onEvolve: () => void;
  onRegenerate: () => void;
  onReset: () => void;
  /**
   * 새로고침으로 되살린 결과인지. 복구본은 브리프·원본 사진이 없어 착용샷·재생성을
   * 할 수 없다 — 버튼을 남겨두면 눌러도 아무 일이 없는 "조용한 고장"이 된다.
   */
  restored?: boolean;
}) {
  const [collageUrl, setCollageUrl] = useState<string | null>(null);
  // 내 손 입혀보기 — 시안별 결과. before = 사용자가 올린 원본 손 사진(전후 비교 슬라이더용)
  const [tryon, setTryon] = useState<
    Record<
      string,
      | { status: 'loading' }
      | { status: 'done'; image: GeneratedImage; before: string }
      | { status: 'error'; message: string }
    >
  >({});
  // 가운데 무대에 무엇을 보여주나 — 시안(set) / 내 손(hand) / AI 모델 손(model)
  const [view, setView] = useState<'set' | 'hand' | 'model'>('set');
  const [cut, setCut] = useState(50);
  // 손 사진은 사람마다 비율이 달라 고정 틀(3:4)이면 손가락 끝(=손톱)이 잘린다 — 사진 비율 그대로
  const [handAspect, setHandAspect] = useState(3 / 4);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  // 배경 빛 번짐 색 — 선택 시안에서 선명한 색만 (사진 전체를 흐리면 회색 받침대 때문에 탁해짐)
  const [glow, setGlow] = useState<string[]>([]);
  // 유료·파괴적 재생성은 2단 확인 — 네이티브 confirm 대신 인라인으로 맥락을 유지한다
  const [confirmRegen, setConfirmRegen] = useState(false);
  // 결과를 만들 때 쓰인 옵션 — 여기서 값이 달라지면 "이 옵션으로 다시 만들기"가 열린다
  const [baseOptions] = useState({ shape, length, partsIntensity });
  const issue = currentIssue();
  const optionsChanged =
    shape !== baseOptions.shape ||
    length !== baseOptions.length ||
    partsIntensity !== baseOptions.partsIntensity;

  const selected = slots.find((s) => s.plan.id === selectedId) ?? null;
  const selectedIndex = selected ? slots.indexOf(selected) : -1;
  const tipSet = selected?.tipSet ?? null;
  const tipSetUrl = tipSet ? `data:${tipSet.mimeType};base64,${tipSet.image}` : null;
  const hero = selected ? (heroMap[selected.plan.id] ?? null) : null;
  const t = selected ? tryon[selected.plan.id] : undefined;
  const doneSlots = slots.filter((s) => s.status === 'done' && s.tipSet);
  const doneIndex = selected ? doneSlots.indexOf(selected) : -1;
  const hasAnyDone = doneSlots.length > 0;

  // 시안을 바꾸면 무대는 시안 보기로 돌아간다 (다른 시안의 손 사진이 남아 보이지 않게)
  useEffect(() => {
    setView('set');
    setCut(50);
  }, [selectedId]);

  useEffect(() => {
    let cancelled = false;
    if (!tipSet) return;
    base64ToBitmap(tipSet.image, tipSet.mimeType)
      .then((bmp) => { if (!cancelled) setGlow(extractVividColors(bmp, 3)); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [tipSet]);

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

  // 착용샷이 막 완성되면 그쪽으로 무대를 돌린다
  useEffect(() => {
    if (collageUrl) setView('model');
  }, [collageUrl]);

  // 좌우 이동 — 완성된 시안 사이에서만. 키보드 화살표·스와이프·버튼이 모두 여기로
  const go = useCallback(
    (d: number) => {
      if (doneSlots.length < 2) return;
      const from = doneIndex < 0 ? 0 : doneIndex;
      const next = doneSlots[(from + d + doneSlots.length) % doneSlots.length];
      onSelect(next.plan.id);
    },
    [doneSlots, doneIndex, onSelect],
  );
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // 입력 중(옵션 등)에는 가로채지 않는다
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return;
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);
  const swipe = useRef<number | null>(null);

  const runTryOn = async (file: File) => {
    if (!selected) return;
    const planId = selected.plan.id;
    const before = URL.createObjectURL(file);
    setTryon((p) => ({ ...p, [planId]: { status: 'loading' } }));
    try {
      const image = await onTryOn(planId, file);
      setTryon((p) => ({ ...p, [planId]: { status: 'done', image, before } }));
      setView('hand');
      setCut(50);
    } catch (e) {
      URL.revokeObjectURL(before);
      const message = (e as Error)?.name === 'TimeoutError'
        ? 'The try-on took too long. Feel free to retry.'
        : (e as Error).message;
      setTryon((p) => ({ ...p, [planId]: { status: 'error', message } }));
    }
  };

  const tryonUrl = t?.status === 'done' ? `data:${t.image.mimeType};base64,${t.image.image}` : null;
  // 지금 무대에 떠 있는 이미지 — 공유는 "보고 있는 것"을 보낸다
  const stageUrl =
    view === 'hand' && tryonUrl ? tryonUrl : view === 'model' && collageUrl ? collageUrl : tipSetUrl;

  const share = async () => {
    if (!stageUrl) return;
    const ext = stageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const how = await shareOrDownload(stageUrl, `idala-${Date.now()}.${ext}`, 'My nail set, made with idala');
    track(how === 'share' ? 'share' : 'save');
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
  const no = (i: number) => String(i + 1).padStart(2, '0');

  const handPicker = (label: string, primary: boolean) => (
    <label className={`st-btn ${primary ? 'primary' : 'ghost'}`}>
      {label}
      <input
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // 같은 파일을 다시 골라도 onChange가 오게
          if (f) void runTryOn(f);
        }}
      />
    </label>
  );

  return (
    <div className="st">
      {/* 배경 — 선택 시안을 흐려 깔아 화면 전체가 그 세트의 색으로 물든다 */}
      {(() => {
        // 선명한 색이 모자라면 무드 색 → 기본 블루로 채운다
        const g = [...glow, ...(mood?.colors ?? []), '#3b6cff', '#c86bff', '#ff7aa8'].slice(0, 3);
        return (
          <div
            className="st-bg"
            key={g.join()}
            style={{ ['--g1' as string]: g[0], ['--g2' as string]: g[1], ['--g3' as string]: g[2] }}
            aria-hidden
          />
        );
      })()}

      {/* 왼쪽 레일 — 시안 목록. 그리는 중·실패·한도 상태를 칸 단위로 */}
      <nav className="st-rail" aria-label="Your looks">
        <span className="st-rail-head">Looks</span>
        {slots.map((slot, i) => {
          if (slot.status === 'done' && slot.tipSet) {
            const on = slot.plan.id === selectedId;
            return (
              <button
                key={slot.plan.id}
                className={`st-thumb${on ? ' is-on' : ''}`}
                aria-pressed={on}
                aria-label={`Look ${no(i)}: ${slot.plan.title}`}
                onClick={() => onSelect(slot.plan.id)}
              >
                <img src={`data:${slot.tipSet.mimeType};base64,${slot.tipSet.image}`} alt="" />
                <span className="st-thumb-no" aria-hidden>{no(i)}</span>
                {slot.quality?.pass === false && <span className="st-thumb-flag" title="Rough take" />}
              </button>
            );
          }
          if (slot.status === 'error') {
            return (
              <div key={slot.plan.id} className="st-thumb is-fail">
                <span>
                  Couldn&apos;t draw
                  <br />
                  <button onClick={() => onRetry(slot.plan.id)}>Retry · free</button>
                </span>
              </div>
            );
          }
          if (slot.status === 'stopped') {
            return (
              <div key={slot.plan.id} className="st-thumb is-fail">
                <span>Daily limit</span>
              </div>
            );
          }
          return <div key={slot.plan.id} className="st-thumb is-pending" aria-label={`Look ${no(i)} is drawing`} />;
        })}
        <button className="st-thumb is-new" onClick={onReset} aria-label="Start a new run">
          New
        </button>
      </nav>

      {/* 가운데 무대 */}
      <section className="st-stage" aria-label="Selected look">
        {selected && (tryonUrl || collageUrl) && (
          <div className="st-seg" role="group" aria-label="View">
            <button aria-pressed={view === 'set'} onClick={() => setView('set')}>Set</button>
            {tryonUrl && <button aria-pressed={view === 'hand'} onClick={() => setView('hand')}>On my hand</button>}
            {collageUrl && <button aria-pressed={view === 'model'} onClick={() => setView('model')}>Model hand</button>}
          </div>
        )}

        <div
          className="st-hero"
          style={
            view === 'hand' && tryonUrl
              ? { aspectRatio: handAspect, width: `min(560px, 100%, calc(72dvh * ${handAspect}))` }
              : undefined
          }
          onPointerDown={(e) => { swipe.current = e.clientX; }}
          onPointerUp={(e) => {
            // 비교 슬라이더를 끄는 중엔 스와이프로 넘기지 않는다
            if (swipe.current === null || view === 'hand') return;
            const dx = e.clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}
        >
          {!selected || !tipSetUrl ? (
            <div className="st-hero-empty">
              {hasAnyDone ? 'Pick a look on the left' : slots.some((s) => s.status === 'pending') ? 'Drawing your looks...' : 'No finished looks yet. Retry one on the left.'}
            </div>
          ) : view === 'hand' && t?.status === 'done' ? (
            <div className="st-ba" style={{ ['--cut' as string]: `${cut}%` }}>
              <img
                src={t.before}
                alt="Your hand before"
                onLoad={(e) => {
                  const im = e.currentTarget;
                  if (im.naturalWidth) setHandAspect(im.naturalWidth / im.naturalHeight);
                }}
              />
              <img className="st-ba-after" src={tryonUrl!} alt={`${selected.plan.title} on your hand`} />
              <div className="st-ba-line"><span className="st-ba-knob" aria-hidden>⇆</span></div>
              <span className="st-ba-tag l">BEFORE</span>
              <span className="st-ba-tag r">AFTER</span>
              <input
                type="range"
                min={2}
                max={98}
                value={cut}
                onChange={(e) => setCut(Number(e.target.value))}
                aria-label="Compare before and after"
              />
            </div>
          ) : (
            // 길게 눌러 저장(iOS)도 되도록 img로 렌더
            <img key={stageUrl ?? ''} src={stageUrl ?? tipSetUrl} alt={`Selected nail set: ${selected.plan.title}`} />
          )}

          {t?.status === 'loading' && (
            <div className="st-busy" role="status" aria-live="polite">
              <span className="st-spinner" aria-hidden />
              <span>
                Finding your nails...
                <small>About 20 seconds. Only your nails will change.</small>
              </span>
            </div>
          )}
          {hero?.status === 'loading' && view !== 'hand' && (
            <div className="st-busy" role="status" aria-live="polite">
              <span className="st-spinner" aria-hidden />
              <span>Putting it on a model hand...</span>
            </div>
          )}
        </div>

        {doneSlots.length > 1 && (
          <div className="st-nav">
            <button onClick={() => go(-1)} aria-label="Previous look">‹</button>
            <span className="st-dots" aria-hidden>
              {doneSlots.map((s) => <i key={s.plan.id} className={s.plan.id === selectedId ? 'on' : ''} />)}
            </span>
            <button onClick={() => go(1)} aria-label="Next look">›</button>
          </div>
        )}
        {view === 'hand' && tryonUrl && <p className="st-caption">Drag across to compare. Your hand stays exactly as uploaded.</p>}
        {view === 'model' && collageUrl && <p className="st-caption">This hand is AI-drawn. Try it on your own hand for the real thing.</p>}
      </section>

      {/* 오른쪽 유리 패널 */}
      <aside className="st-panel" aria-label="Look details">
        {selected ? (
          <>
            <div>
              <p className="st-eyebrow" suppressHydrationWarning>
                Look {no(selectedIndex)} of {String(slots.length).padStart(2, '0')} · {issue.monthLabel}
              </p>
              <h2 className="st-title">{selected.plan.title}</h2>
            </div>
            {selected.plan.note && <p className="st-note">{selected.plan.note}</p>}

            {(colors.length > 0 || keywords.length > 0) && (
              <div className="st-mood">
                {colors.length > 0 && (
                  // 빈 span에 배경색만 있으면 접근성 트리에서 색 정보가 통째로 사라진다
                  <span className="st-swatches" role="list" aria-label="Colors in this look">
                    {colors.slice(0, 4).map((c, i) => (
                      <span role="listitem" key={i} style={{ background: c }} aria-label={c} />
                    ))}
                  </span>
                )}
                {keywords.length > 0 && <span className="st-keywords">{keywords.join(' · ')}</span>}
              </div>
            )}

            <div className="st-meta">
              {craft && <div>Difficulty<b>{DIFFICULTY_LABEL[craft.difficulty] ?? craft.difficulty}</b></div>}
              {selected.quality && (
                <div className={selected.quality.pass ? '' : 'warn'}>
                  Quality check<b>{selected.quality.score} / {selected.quality.maxScore}</b>
                </div>
              )}
              <div>Shape<b style={{ textTransform: 'capitalize' }}>{baseOptions.shape}</b></div>
              <div>Length<b style={{ textTransform: 'capitalize' }}>{baseOptions.length}</b></div>
            </div>

            {/* 시술 정보 — 핀터레스트와 다르다는 근거(검수 심사평·조정 메모)는 접어서 둔다 */}
            {(craft?.notes || selected.quality?.notes || (selected.quality?.issues?.length ?? 0) > 0) && (
              <details className="st-details">
                <summary>Salon notes</summary>
                <div className="st-details-body">
                  {craft?.notes && <p>{craft.notes}</p>}
                  {selected.quality?.notes && <p>{selected.quality.notes}</p>}
                  {(selected.quality?.issues?.length ?? 0) > 0 && (
                    <ul>{selected.quality!.issues.map((x) => <li key={x}>{x}</li>)}</ul>
                  )}
                </div>
              </details>
            )}

            {photos.length > 0 && (
              <div className="st-source">
                From
                {photos.map((p, i) => <img key={i} src={p.previewUrl} alt="" />)}
                <span>your photo{photos.length > 1 ? 's' : ''}</span>
              </div>
            )}

            <div className="st-actions">
              {t?.status === 'error' && <p className="st-error" role="status">{t.message}</p>}
              {heroError && <p className="st-error" role="status">{heroError}</p>}
              {!restored && t?.status !== 'loading' &&
                handPicker(t?.status === 'done' ? 'Try another hand photo' : 'Try it on my hand', true)}

              {/* 로그인했으면 파일 저장 말고 계정에 남길 수 있다 — 무대에 떠 있는 것을 저장 */}
              {signedIn && tipSet && (
                view === 'hand' && t?.status === 'done' ? (
                  <SaveToLibrary
                    key={`hand-${t.image.image.slice(-32)}`}
                    image={t.image.image}
                    mimeType={t.image.mimeType}
                    title={`${selected.plan.title} · on my hand`}
                    note="Tried on my hand"
                    shape={shape}
                    length={length}
                    quality={null}
                    mood={mood}
                  />
                ) : (
                  <SaveToLibrary
                    key={`set-${selected.plan.id}`}
                    image={tipSet.image}
                    mimeType={tipSet.mimeType}
                    title={selected.plan.title}
                    note={selected.plan.note ?? null}
                    shape={shape}
                    length={length}
                    quality={selected.quality}
                    mood={mood}
                  />
                )
              )}

              <div className="st-row">
                <button className="st-btn ghost" onClick={share} disabled={!stageUrl}>Share</button>
                <button className="st-btn ghost" onClick={saveTipSet} disabled={!tipSetUrl}>Download</button>
                {!restored && !hero && (
                  <button className="st-btn ghost" onClick={() => onHero(selected.plan.id)}>Model hand</button>
                )}
              </div>

              {/* 재생성 입구는 여기 하나뿐 — 유료·파괴적 액션은 입구를 하나로 모으고 확인을 받는다 */}
              {hasAnyDone && !restored && (
                <details className="st-details">
                  <summary>Change shape, length or photos</summary>
                  <div className="st-details-body">
                    <OptionsPicker
                      shape={shape}
                      length={length}
                      partsIntensity={partsIntensity}
                      onShape={onShape}
                      onLength={onLength}
                      onPartsIntensity={onPartsIntensity}
                    />
                    {confirmRegen ? (
                      <div role="group" aria-label="Confirm remake">
                        <p className="assurance">This replaces the current looks and uses 1 run. Save anything you want to keep first.</p>
                        <div className="st-row">
                          <button className="st-btn ghost" onClick={() => setConfirmRegen(false)}>Cancel</button>
                          <button className="st-btn primary" onClick={onRegenerate}>Yes, remake</button>
                        </div>
                      </div>
                    ) : (
                      <button className="st-btn ghost" onClick={() => setConfirmRegen(true)}>
                        {optionsChanged ? 'Remake with these options' : 'Remake with the same options'}
                        <span className="cost-tag">1 run</span>
                      </button>
                    )}
                    <button className="st-btn ghost" onClick={evolve}>Add photos & evolve</button>
                  </div>
                </details>
              )}

              {/* 복구본이라 무엇이 되고 무엇이 안 되는지 먼저 밝힌다 */}
              {restored && (
                <p className="assurance">
                  We restored your looks from before the refresh. You can still save them, but try-ons and remakes need your photos again.
                </p>
              )}
              {!signedIn && <p className="assurance">Results vanish when you close the tab, so download the ones you love.</p>}
            </div>
          </>
        ) : (
          <p className="st-note">{hasAnyDone ? 'Pick a look to see its details.' : 'Your looks are on their way.'}</p>
        )}

        <div className="st-foot">
          {remaining !== null ? <span>{remaining} runs left</span> : <span />}
          <button onClick={onReset}>Start over</button>
        </div>
      </aside>
    </div>
  );
}
