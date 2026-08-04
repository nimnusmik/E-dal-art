'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GeneratingScreen from '@/components/GeneratingScreen';
import InspirationTray from '@/components/InspirationTray';
import OptionsPicker from '@/components/OptionsPicker';
import ResultScreen from '@/components/ResultScreen';
import Landing from '@/components/landing/Landing';
import { currentIssue } from '@/lib/issue';
import { fileToResizedPayload } from '@/lib/resize';
import type { NailBrief } from '@/lib/brief';
import type { Mood, NailLength, NailShape, PartsIntensity, VariantPlan } from '@/lib/types';

// 타입 원본은 lib/types.ts (계약: docs/api-variants-contract.md).
// 컴포넌트들이 '@/app/page'에서 가져다 쓰므로 여기서 재수출한다.
export type { PartsIntensity, VariantPlan } from '@/lib/types';

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

/** variant 슬롯 하나의 진행 상태 — 5개가 완성되는 순서대로 개별 갱신된다 */
export type VariantStatus =
  | 'pending' // 생성 중 (스켈레톤)
  | 'done' // 팁셋 도착
  | 'error' // 개별 실패 (REJECTED/502 등) — 슬롯 단위 재시도 가능
  | 'stopped'; // RATE_LIMIT_VARIANT로 중단 — 재시도 불가

export interface VariantSlot {
  plan: VariantPlan;
  status: VariantStatus;
  tipSet: GeneratedImage | null;
  quality: { pass: boolean; score: number } | null;
}

/** 착용샷은 시안당 1회만 호출하고 캐시 — planId 키 */
export interface HeroEntry {
  status: 'loading' | 'done';
  image: GeneratedImage | null;
}

// 상태 머신: start → analyzing(분석 ~10초) → generating(variant 5개 도착 중)
// → result(전부 정착 또는 유저가 카드 선택). 부분 완료 상태에서도 인터랙션 허용.
type Phase = 'start' | 'analyzing' | 'generating' | 'result' | 'blocked-user' | 'blocked-total';

const MAX_PHOTOS = 3;

export default function Home() {
  const [phase, setPhase] = useState<Phase>('start');
  const [photos, setPhotos] = useState<TrayPhoto[]>([]);
  const [shape, setShape] = useState<NailShape>('almond');
  const [length, setLength] = useState<NailLength>('medium');
  const [partsIntensity, setPartsIntensity] = useState<PartsIntensity>('auto');
  const [slots, setSlots] = useState<VariantSlot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heroMap, setHeroMap] = useState<Record<string, HeroEntry>>({});
  const [mood, setMood] = useState<Mood | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 진화(evolve)로 start에 복귀할 때 툴 섹션으로 즉시 앵커하기 위한 플래그
  const anchorToolRef = useRef(false);
  // 세션 토큰 — 리셋/재생성 이후 도착하는 이전 세션 응답을 무시
  const sessionRef = useRef(0);
  // analyze가 준 브리프·전송 이미지 — variant 재시도와 hero 호출에 재사용
  const briefRef = useRef<NailBrief | null>(null);
  const imagesRef = useRef<{ data: string; mimeType: string }[]>([]);

  useEffect(() => {
    if (phase === 'start' && anchorToolRef.current) {
      anchorToolRef.current = false;
      document.getElementById('tool')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else if (phase === 'analyzing' || phase === 'generating' || phase === 'result') {
      // 전체 뷰 전환 — 스토리의 스크롤 위치가 남아 화면이 중간에서 시작하는 것 방지
      window.scrollTo(0, 0);
    }
  }, [phase]);

  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 3500);
    return () => clearTimeout(t);
  }, [error]);

  // 시작 화면 잔여 횟수 (GET /api/analyze — 조회만, 차감 없음)
  useEffect(() => {
    fetch('/api/analyze')
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { remaining?: number } | null) => {
        if (json && typeof json.remaining === 'number') setRemaining(json.remaining);
      })
      .catch(() => {}); // 표시용이라 실패는 무시
  }, []);

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

  /** 슬롯 하나만 부분 갱신 */
  const patchSlot = useCallback((planId: string, patch: Partial<VariantSlot>) => {
    setSlots((prev) => prev.map((s) => (s.plan.id === planId ? { ...s, ...patch } : s)));
  }, []);

  /** variant 1건 생성 — 개별 then으로 완성순 렌더 (Promise.all 대기 금지) */
  const fetchVariant = useCallback(
    async (plan: VariantPlan, session: number) => {
      const brief = briefRef.current;
      if (!brief) return;
      try {
        const res = await fetch('/api/variant', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ images: imagesRef.current, brief, plan }),
        });
        const json = await res.json();
        if (sessionRef.current !== session) return; // 이전 세션 응답 폐기
        if (res.ok) {
          patchSlot(plan.id, { status: 'done', tipSet: json.tipSet, quality: json.quality ?? null });
          return;
        }
        if (json.error === 'RATE_LIMIT_VARIANT') {
          // 한도 도달 — 아직 대기 중인 슬롯만 중단하고 안내 (완성된 시안은 유지)
          setSlots((prev) =>
            prev.map((s) => (s.status === 'pending' ? { ...s, status: 'stopped' } : s)),
          );
          setError('오늘 시안 생성 한도에 도달했어요. 먼저 완성된 시안은 그대로 볼 수 있어요');
          return;
        }
        // REJECTED/502 등 개별 실패 — 이 슬롯만 재시도 버튼으로 (전체를 죽이지 않는다)
        patchSlot(plan.id, { status: 'error' });
      } catch {
        if (sessionRef.current === session) patchSlot(plan.id, { status: 'error' });
      }
    },
    [patchSlot],
  );

  /** 실패 슬롯 재시도 */
  const retrySlot = useCallback(
    (planId: string) => {
      const slot = slots.find((s) => s.plan.id === planId);
      if (!slot || slot.status !== 'error') return;
      patchSlot(planId, { status: 'pending' });
      void fetchVariant(slot.plan, sessionRef.current);
    },
    [slots, patchSlot, fetchVariant],
  );

  /** 분석 → 5종 병렬 생성 시작 */
  const generate = useCallback(async () => {
    if (photos.length === 0) return;
    const session = ++sessionRef.current;
    const images = photos.map(({ data, mimeType }) => ({ data, mimeType }));
    imagesRef.current = images;
    briefRef.current = null;
    setSlots([]);
    setSelectedId(null);
    setHeroMap({});
    setMood(null);
    setPhase('analyzing');
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ images, shape, length, partsIntensity }),
      });
      const json = await res.json();
      if (sessionRef.current !== session) return;
      if (res.ok) {
        const brief: NailBrief = json.brief;
        const plans: VariantPlan[] = json.plans;
        briefRef.current = brief;
        setMood({ keywords: brief.keywords ?? [], colors: brief.colors ?? [] });
        setRemaining(json.remaining);
        setSlots(plans.map((plan) => ({ plan, status: 'pending', tipSet: null, quality: null })));
        setPhase('generating');
        // 5개를 병렬 발사 — await 없이 각자 resolve되는 순서대로 슬롯이 채워진다
        plans.forEach((plan) => void fetchVariant(plan, session));
        return;
      }
      if (json.error === 'RATE_LIMIT_USER') { setPhase('blocked-user'); return; }
      if (json.error === 'RATE_LIMIT_TOTAL') { setPhase('blocked-total'); return; }
      setPhase('start');
      setError(
        json.error === 'INVALID_INPUT'
          ? '이 사진으로는 만들기 어려워요. 다른 사진으로 시도해주세요'
          : '사진 분석에 실패했어요. 잠시 후 다시 시도해주세요',
      );
    } catch {
      if (sessionRef.current !== session) return;
      setPhase('start');
      setError('사진 분석에 실패했어요. 잠시 후 다시 시도해주세요');
    }
  }, [photos, shape, length, partsIntensity, fetchVariant]);

  // 5개가 전부 정착(성공/실패/중단)하면 결과 화면으로 — 유저가 먼저 선택하면 그 시점에 넘어간다
  useEffect(() => {
    if (phase !== 'generating' || slots.length === 0) return;
    if (slots.some((s) => s.status === 'pending')) return;
    setPhase('result');
  }, [phase, slots]);

  // 결과 화면에 선택 없이 진입하면 첫 완성 시안을 자동 선택
  useEffect(() => {
    if (phase !== 'result' || selectedId) return;
    const first = slots.find((s) => s.status === 'done');
    if (first) setSelectedId(first.plan.id);
  }, [phase, selectedId, slots]);

  /** 생성 중 카드 선택 → 부분 완료 상태라도 바로 결과 화면으로 */
  const selectVariant = useCallback((planId: string) => {
    setSelectedId(planId);
    setPhase('result');
  }, []);

  /** 착용샷 온디맨드 — 시안당 1회만 호출하고 캐시 */
  const requestHero = useCallback(
    async (planId: string) => {
      const slot = slots.find((s) => s.plan.id === planId);
      if (!slot?.tipSet) return;
      if (heroMap[planId]) return; // 이미 로딩 중이거나 완료 — 중복 호출 방지
      const session = sessionRef.current;
      setHeroMap((prev) => ({ ...prev, [planId]: { status: 'loading', image: null } }));
      try {
        const res = await fetch('/api/hero', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            images: imagesRef.current,
            tipSet: { image: slot.tipSet.image, mimeType: slot.tipSet.mimeType },
            shape,
            length,
          }),
        });
        const json = await res.json();
        if (sessionRef.current !== session) return;
        if (res.ok) {
          setHeroMap((prev) => ({ ...prev, [planId]: { status: 'done', image: json.hero } }));
          return;
        }
        // 실패는 캐시에서 지워 재시도 가능하게
        setHeroMap((prev) => {
          const next = { ...prev };
          delete next[planId];
          return next;
        });
        setError(
          json.error === 'RATE_LIMIT_HERO'
            ? '오늘 착용샷 생성 한도에 도달했어요. 내일 다시 시도해주세요'
            : '착용샷 생성에 실패했어요. 다시 시도해주세요',
        );
      } catch {
        if (sessionRef.current !== session) return;
        setHeroMap((prev) => {
          const next = { ...prev };
          delete next[planId];
          return next;
        });
        setError('착용샷 생성에 실패했어요. 다시 시도해주세요');
      }
    },
    [slots, heroMap, shape, length],
  );

  if (phase === 'start') {
    return (
      <Landing
        toolSlot={
          <>
            <div className="xp-tool-head">
              <span className="xp-pill t-yellow" suppressHydrationWarning>
                Vol.{currentIssue().vol}
              </span>
              {/* h1은 히어로가 차지 — 툴 섹션 헤드라인은 h2 */}
              <h2>
                영감 사진을 올리면,
                <br />
                이달의 시안이 나와요
              </h2>
            </div>
            <p className="sub">사진을 더할수록 디자인이 진화해요 (최대 3장)</p>
            <InspirationTray photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
            {photos.length > 0 && (
              <OptionsPicker
                shape={shape}
                length={length}
                partsIntensity={partsIntensity}
                onShape={setShape}
                onLength={setLength}
                onPartsIntensity={setPartsIntensity}
              />
            )}
            <button className="cta" disabled={photos.length === 0} onClick={generate}>
              이번 호 시안 만들기
            </button>
            {/* 잔여 횟수는 얼마 안 남았을 때만 노출 — 개발용 큰 한도가 그대로 보이는 것 방지 */}
            {remaining !== null && remaining <= 10 && (
              <p className="remaining">오늘 {remaining}회 남음</p>
            )}
            {error && <div className="error-toast">{error}</div>}
          </>
        }
      />
    );
  }

  if (phase === 'analyzing' || phase === 'generating') {
    return (
      <main className="screen">
        <GeneratingScreen
          stage={phase === 'analyzing' ? 'analyzing' : 'variants'}
          slots={slots}
          onRetry={retrySlot}
          onSelect={selectVariant}
        />
        {error && <div className="error-toast">{error}</div>}
      </main>
    );
  }

  if (phase === 'result') {
    return (
      <main className="screen">
        <ResultScreen
          slots={slots}
          selectedId={selectedId}
          heroMap={heroMap}
          mood={mood}
          photos={photos}
          remaining={remaining}
          onSelect={setSelectedId}
          onRetry={retrySlot}
          onHero={requestHero}
          onEvolve={() => {
            anchorToolRef.current = true;
            setPhase('start');
          }}
          onRegenerate={generate}
          onReset={() => {
            setPhotos([]);
            setSlots([]);
            setSelectedId(null);
            setHeroMap({});
            setMood(null);
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
        <div className="blocked">
          <div className="blocked-card">
            <p className="overline">Sold Out</p>
            <h2 className="headline">오늘의 발행이 마감됐어요</h2>
            <p className="sub">자정에 다시 채워져요. 내일 다시 만나요.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen">
      <div className="blocked">
        <div className="blocked-card">
          <p className="overline">Sold Out</p>
          <h2 className="headline">이번 호가 매진됐어요</h2>
          <p className="sub">오늘 준비된 생성이 모두 끝났어요. 내일 다시 찾아와주세요.</p>
        </div>
      </div>
    </main>
  );
}
