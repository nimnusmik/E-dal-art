'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GeneratingScreen from '@/components/GeneratingScreen';
import InspirationTray from '@/components/InspirationTray';
import OptionsPicker from '@/components/OptionsPicker';
import ResultScreen from '@/components/ResultScreen';
import BrandBadge from '@/components/retro/BrandBadge';
import Marquee from '@/components/retro/Marquee';
import RetroWindow from '@/components/retro/RetroWindow';
import DecorLayer from '@/components/retro/Sparkles';
import StoryLanding from '@/components/story/StoryLanding';
import { DEFAULT_TREND_KEYWORDS } from '@/config/trends';
import { fileToResizedPayload } from '@/lib/resize';
import type { Mood, NailLength, NailShape } from '@/lib/types';

export interface TrayPhoto {
  id: string;
  data: string;
  mimeType: string;
  previewUrl: string;
}

export interface GeneratedImage {
  image: string; // base64
  mimeType: string;
}

export interface GenerationResult {
  hero: GeneratedImage; // 손 착용샷 (콜라주 히어로)
  tipSet: GeneratedImage | null; // 개별 팁 10개 세트
  mood: Mood | null;
}

type Phase = 'start' | 'generating' | 'result' | 'blocked-user' | 'blocked-total';

const MAX_PHOTOS = 3;

export default function Home() {
  const [phase, setPhase] = useState<Phase>('start');
  const [photos, setPhotos] = useState<TrayPhoto[]>([]);
  const [shape, setShape] = useState<NailShape>('almond');
  const [length, setLength] = useState<NailLength>('medium');
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 진화(evolve)로 start에 복귀할 때 툴 섹션으로 즉시 앵커하기 위한 플래그
  const anchorToolRef = useRef(false);

  useEffect(() => {
    if (phase === 'start' && anchorToolRef.current) {
      anchorToolRef.current = false;
      document.getElementById('tool')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else if (phase === 'generating' || phase === 'result') {
      // 전체 뷰 전환 — 스토리의 스크롤 위치가 남아 화면이 중간에서 시작하는 것 방지
      window.scrollTo(0, 0);
    }
  }, [phase]);

  useEffect(() => {
    fetch('/api/generate')
      .then((r) => r.json())
      .then((j: { remaining: number }) => setRemaining(j.remaining))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  const addPhotos = useCallback(async (files: FileList) => {
    const freeSlots = MAX_PHOTOS - photos.length;
    if (freeSlots <= 0) return;
    const incoming = Array.from(files).slice(0, freeSlots);
    const settled = await Promise.allSettled(
      incoming.map(async (file) => {
        const payload = await fileToResizedPayload(file);
        return { id: crypto.randomUUID(), ...payload };
      }),
    );
    const resized = settled
      .filter((s): s is PromiseFulfilledResult<TrayPhoto> => s.status === 'fulfilled')
      .map((s) => s.value);
    if (files.length > freeSlots) {
      setError(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
    }
    if (resized.length < incoming.length) {
      setError('불러올 수 없는 사진이 있어요. 다른 사진으로 시도해주세요');
    }
    if (resized.length > 0) {
      setPhotos((prev) => [...prev, ...resized].slice(0, MAX_PHOTOS));
    }
  }, [photos]);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const generate = useCallback(async () => {
    if (photos.length === 0) return;
    setPhase('generating');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          images: photos.map(({ data, mimeType }) => ({ data, mimeType })),
          shape,
          length,
        }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({ hero: json.hero, tipSet: json.tipSet, mood: json.mood });
        setRemaining(json.remaining);
        setPhase('result');
        return;
      }
      if (json.error === 'RATE_LIMIT_USER') { setPhase('blocked-user'); return; }
      if (json.error === 'RATE_LIMIT_TOTAL') { setPhase('blocked-total'); return; }
      setPhase(result ? 'result' : 'start');
      setError(
        json.error === 'REJECTED'
          ? '이 사진으로는 만들기 어려워요. 다른 사진으로 시도해주세요'
          : '생성에 실패했어요. 다시 시도해주세요',
      );
    } catch {
      setPhase(result ? 'result' : 'start');
      setError('생성에 실패했어요. 다시 시도해주세요');
    }
  }, [photos, shape, length, result]);

  if (phase === 'start') {
    return (
      <StoryLanding
        toolSlot={
          <>
            <DecorLayer />
            <BrandBadge />
            {/* h1은 스토리 히어로가 차지 — 툴 섹션 헤드라인은 h2로 강등 */}
            <h2 className="headline">
              영감 사진을 올리면,
              <br />
              이달의 네일 아트
              <br />
              시안이 나와요
            </h2>
            <p className="sub">사진을 더할수록 디자인이 진화해요 (최대 3장)</p>
            <Marquee items={DEFAULT_TREND_KEYWORDS} />
            <InspirationTray photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
            {photos.length > 0 && (
              <OptionsPicker shape={shape} length={length} onShape={setShape} onLength={setLength} />
            )}
            <button className="cta" disabled={photos.length === 0} onClick={generate}>
              네일 디자인 만들기
            </button>
            {remaining !== null && <p className="remaining">오늘 {remaining}회 남음</p>}
            {error && <div className="error-toast">{error}</div>}
          </>
        }
      />
    );
  }

  if (phase === 'generating') {
    return (
      <main className="screen">
        <DecorLayer variant="compact" />
        <BrandBadge />
        <GeneratingScreen />
      </main>
    );
  }

  if (phase === 'result' && result) {
    return (
      <main className="screen">
        <DecorLayer variant="compact" />
        <BrandBadge />
        <ResultScreen
          result={result}
          photos={photos}
          remaining={remaining}
          onEvolve={() => {
            anchorToolRef.current = true;
            setPhase('start');
          }}
          onRegenerate={generate}
          onReset={() => {
            setPhotos([]);
            setResult(null);
            setPhase('start');
          }}
        />
        {error && <div className="error-toast">{error}</div>}
      </main>
    );
  }

  // Task 14: blocked 화면
  if (phase === 'blocked-user') {
    return (
      <main className="screen">
        <DecorLayer variant="compact" />
        <BrandBadge />
        <div className="blocked">
          <RetroWindow title="NOTICE.TXT" className="blocked-window">
            <span className="big">🌙</span>
            <h2 className="headline">내일 다시 만나요</h2>
            <p className="sub">오늘의 생성 횟수를 모두 사용했어요. 자정에 다시 채워져요.</p>
          </RetroWindow>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <DecorLayer variant="compact" />
      <BrandBadge />
      <div className="blocked">
        <RetroWindow title="NOTICE.TXT" className="blocked-window">
          <span className="big">💅</span>
          <h2 className="headline">오늘 준비된 생성이 모두 끝났어요</h2>
          <p className="sub">내일 다시 찾아와주세요.</p>
        </RetroWindow>
      </div>
    </main>
  );
}
