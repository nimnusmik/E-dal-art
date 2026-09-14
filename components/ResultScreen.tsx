'use client';

import { useEffect, useState } from 'react';
import OptionsPicker from '@/components/OptionsPicker';
import PriceProbe from '@/components/PriceProbe';
import VariantGrid from '@/components/VariantGrid';
import { drawCollage, extractColors } from '@/lib/collage';
import { currentIssue } from '@/lib/issue';
import type { HeroEntry, PartsIntensity, TrayPhoto, VariantSlot } from '@/app/page';
import type { Mood, NailLength, NailShape } from '@/lib/types';

const DIFFICULTY_KO: Record<string, string> = {
  easy: '쉬움',
  medium: '보통',
  hard: '어려움',
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
  a.click();
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
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
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

  const shareHero = async () => {
    if (!collageUrl) return;
    const ext = collageUrl.startsWith('data:image/png') ? 'png' : 'jpg';
    const how = await shareOrDownload(
      collageUrl,
      `idala-${Date.now()}.${ext}`,
      '이달아에서 만든 이달의 네일 시안이에요',
    );
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
  const hasAnyDone = slots.some((s) => s.status === 'done');

  return (
    <>
      {/* 선택된 시안 — 확대 보기 */}
      <div className="result-figure">
        <h2 className="overline" suppressHydrationWarning>
          Your Pick — {issue.monthLabel}
        </h2>
        {selected && tipSetUrl ? (
          <>
            {/* 길게 눌러 저장(iOS)도 되도록 img로 렌더 */}
            <img
              className="result-img"
              src={tipSetUrl}
              alt={`선택한 네일 시안 — ${selected.plan.title}`}
            />
            <div className="pick-head">
              <h3 className="pick-title">
                {selectedIndex >= 0 && (
                  <span className="pick-no" aria-hidden>
                    {String(selectedIndex + 1).padStart(2, '0')}
                  </span>
                )}
                {selected.plan.title}
              </h3>
              {/* 검수 결과는 바로 아래 "시술 정보"가 근거까지 보여준다 — 여기 배지는 중복 */}
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

      {/* 시술 정보 — 이 제품이 핀터레스트와 다르다고 주장하는 근거를 실제로 보여주는 자리.
          검수 심사평(왜 통과/왜 아쉬운지)과 난이도·조정 메모를 함께 둔다. */}
      {selected && (selected.quality || craft) && (
        <div className="craft-block">
          <h3 className="craft-head">시술 정보</h3>
          {craft && (
            <p className="craft-row">
              <span className={`craft-level lv-${craft.difficulty}`}>
                난이도 {DIFFICULTY_KO[craft.difficulty] ?? craft.difficulty}
              </span>
              {craft.notes && <span className="craft-notes">{craft.notes}</span>}
            </p>
          )}
          {selected.quality && (
            <div className="craft-judge">
              <p className="craft-judge-head">
                {selected.quality.pass ? '검수 통과' : '검수에서 걸린 부분이 있어요'}
                <span className="craft-score">
                  {selected.quality.score}/{selected.quality.maxScore}점
                </span>
              </p>
              {selected.quality.notes && (
                <p className="craft-judge-note">{selected.quality.notes}</p>
              )}
              {/* 옵셔널 체이닝 — 스키마가 또 바뀌어도 화면이 통째로 죽지는 않게 */}
              {selected.quality.issues?.length > 0 && (
                <ul className="craft-issues">
                  {selected.quality.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {(keywords.length > 0 || colors.length > 0) && (
        <div className="mood-line">
          {/* 키워드가 없을 땐(색상 추출 모드) 스와치만 덩그러니 놓이지 않게 라벨을 붙인다 */}
          <span className="mood-keywords">
            {keywords.length > 0 ? keywords.join(' · ') : '이 시안의 컬러'}
          </span>
          {/* 빈 span에 배경색만 있으면 접근성 트리에서 색 정보가 통째로 사라진다 */}
          {colors.length > 0 && (
            <span className="swatches" role="list" aria-label="이 시안의 컬러">
              {colors.slice(0, 3).map((c, i) => (
                <span
                  className="swatch"
                  role="listitem"
                  key={i}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </span>
          )}
        </div>
      )}

      {/* 착용샷 — 시안당 1회 온디맨드 생성, 결과는 캐시 */}
      {selected && tipSetUrl && (
        <div className="hero-block">
          {!hero && !restored && (
            <button className="btn-fill" onClick={() => onHero(selected.plan.id)}>
              이 시안 착용샷 보기
            </button>
          )}
          {heroError && (
            <p className="assurance hero-error" role="status">
              {heroError}
            </p>
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
              <>
                <img className="result-img" src={collageUrl} alt="생성된 네일 착용샷 콜라주" />
                {/* "내 손"으로 오해하지 않게 명시한다 — 사용자 손 사진을 받는 입력은 아직 없다 */}
                <p className="hero-caption">
                  AI가 그린 손이에요. 내 손 사진을 올려 합성하는 기능은 준비 중이에요.
                </p>
              </>
            ) : (
              <div className="result-loading" role="status" aria-live="polite">
                <p className="sub">이미지 정리 중...</p>
                <div className="progress-track" aria-hidden>
                  <div className="progress-fill" />
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 가치를 가장 크게 체감하는 자리 — 착용샷을 막 본 직후.
          예전엔 페이지 최하단, 그것도 "탭 닫으면 사라지니 받아두세요"(이탈 유도)
          바로 뒤에 있어서, 사용자를 내보낸 다음 결제 의사를 묻는 순서였다. */}
      {hasAnyDone && <PriceProbe />}

      {/* 시안 5종 그리드 — 아직 그려지는 중이어도 완성분부터 갈아탈 수 있다 */}
      <div className="tipset-block">
        <h2 className="overline">Five Looks{stillDrawing ? ' — 그리는 중' : ''}</h2>
        <VariantGrid slots={slots} selectedId={selectedId} onSelect={onSelect} onRetry={onRetry} />
      </div>

      {/* 쉐입·길이·파츠를 결과에서 바로 바꿔 다시 만든다 —
          "길이와 쉐입을 바꿔가며 비교할 수 있어요"라는 약속의 실행 경로 */}
      {hasAnyDone && !restored && (
        <div className="recut">
          <p className="recut-head">다른 쉐입·길이로도 볼까요?</p>
          <OptionsPicker
            shape={shape}
            length={length}
            partsIntensity={partsIntensity}
            onShape={onShape}
            onLength={onLength}
            onPartsIntensity={onPartsIntensity}
          />
          {/* 재생성 입구는 여기 하나뿐이다. 예전엔 하단에 "다시 생성" 14px 링크가
              무료 "새로 시작" 옆 96px에 있어, 확인도 없이 1회를 태우고 시안 5장을
              지웠다. 유료·파괴적 액션은 입구를 하나로 모으고 확인을 받는다. */}
          {confirmRegen ? (
            <div className="confirm-row" role="group" aria-label="다시 만들기 확인">
              <p className="assurance">
                지금 시안 5장이 사라지고 오늘 1회를 써요. 저장 안 한 시안이 있으면 먼저
                받아두세요.
              </p>
              <div className="actions-row">
                <button className="btn-outline" onClick={() => setConfirmRegen(false)}>
                  취소
                </button>
                <button className="btn-fill" onClick={onRegenerate}>
                  네, 다시 만들기
                </button>
              </div>
            </div>
          ) : (
            <button className="btn-outline recut-cta" onClick={() => setConfirmRegen(true)}>
              {optionsChanged ? '이 옵션으로 다시 만들기' : '같은 옵션으로 새로 뽑기'}
              <span className="cost-tag">1회</span>
            </button>
          )}
        </div>
      )}

      {/* 복구본이라 무엇이 되고 무엇이 안 되는지 먼저 밝힌다 */}
      {restored && (
        <p className="assurance restored-note">
          새로고침 전 시안을 되살렸어요. 저장은 되지만 착용샷·다시 만들기는 사진을 다시
          올려야 해요.
        </p>
      )}

      {/* 버튼 위계: 화면당 btn-fill은 1개. 비활성 프라이머리를 시선 최상단에 두면
          "가장 큰 버튼이 안 눌리는" 완료 화면이 된다 — 콜라주가 없으면 저장을 올린다. */}
      <div className="actions">
        {collageUrl && (
          <button className="btn-fill" onClick={shareHero}>
            착용샷 공유하기
          </button>
        )}
        <div className="actions-row">
          <button
            className={collageUrl ? 'btn-outline' : 'btn-fill'}
            onClick={saveTipSet}
            disabled={!tipSetUrl}
          >
            시안 이미지 저장
          </button>
          {!restored && (
            <button className="btn-outline" onClick={evolve}>
              사진 더해 진화
            </button>
          )}
        </div>
        <p className="assurance">
          사진을 길게 눌러도 저장할 수 있어요. 탭을 닫으면 결과가 사라지니 꼭 받아두세요.
        </p>
        <div className="actions-links">
          <button className="btn-link" onClick={onReset}>
            새로 시작
          </button>
        </div>
      </div>
      {remaining !== null && <p className="remaining">오늘 {remaining}회 남음</p>}
    </>
  );
}
