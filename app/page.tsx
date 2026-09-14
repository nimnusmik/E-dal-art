'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import GeneratingScreen from '@/components/GeneratingScreen';
import InspirationTray from '@/components/InspirationTray';
import OptionsPicker from '@/components/OptionsPicker';
import ResultScreen from '@/components/ResultScreen';
import Landing from '@/components/landing/Landing';
import { useIssue } from '@/lib/useIssue';
import { fileToResizedPayload } from '@/lib/resize';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '@/lib/resume';
import { clearInvite, inviteHeaders, setInvite } from '@/lib/invite';
import { fetchGate } from '@/lib/useGate';
import type { NailBrief } from '@/lib/brief';
import type { QualityReport } from '@/lib/judge';
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
  /** 검수 결과 — 통과 여부만이 아니라 심사평·미달 항목까지 (lib/judge.ts QualityReport) */
  quality: QualityReport | null;
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

/** 에러 종류 — 입력 관련은 툴 카드 안 인라인 배너, 시스템 오류는 토스트 */
type AppError = { text: string; kind: 'inline' | 'toast' } | null;

export default function Home() {
  const issue = useIssue();
  const [phase, setPhase] = useState<Phase>('start');
  const [photos, setPhotos] = useState<TrayPhoto[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState(0);
  const [shape, setShape] = useState<NailShape>('almond');
  const [length, setLength] = useState<NailLength>('medium');
  const [partsIntensity, setPartsIntensity] = useState<PartsIntensity>('auto');
  const [slots, setSlots] = useState<VariantSlot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [heroMap, setHeroMap] = useState<Record<string, HeroEntry>>({});
  const [mood, setMood] = useState<Mood | null>(null);
  /**
   * 시술 정보 — 브리프의 difficulty·feasibilityNotes.
   * 분석 단계에서 이미 한국어로 만들어져 있었는데 화면에 0글자였다. "구경은
   * 핀터레스트에서, 확정은 이달아에서"라는 주장의 유일한 물증이라 결과에 싣는다.
   */
  const [craft, setCraft] = useState<{ difficulty: string; notes: string } | null>(null);
  /** 착용샷 실패 사유 — 토스트로 6초 뒤 사라지면 왜 안 됐는지 알 길이 없다 */
  const [heroError, setHeroError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  /**
   * 초대 게이트 상태. 이미지 생성은 무료 티어가 없어 호출 1건이 곧 실비이므로,
   * 수요 검증이 끝나기 전까지는 초대받은 사람만 생성한다(지출을 구조적으로 0에 가깝게).
   * gateOpen=false면 툴 카드가 생성 CTA 대신 코드 입력을 보여준다.
   */
  const [inviteOn, setInviteOn] = useState(false);
  const [gateOpen, setGateOpen] = useState(true);
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState<AppError>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifyDone, setNotifyDone] = useState(false);
  // 새로고침으로 되살린 결과 — 브리프·원본 사진이 없어 착용샷·재생성이 불가능하다
  const [restored, setRestored] = useState(false);
  // 진화(evolve)·실패 복귀로 start에 돌아올 때 툴 섹션으로 즉시 앵커하기 위한 플래그
  const anchorToolRef = useRef(false);
  // 세션 토큰 — 리셋/재생성 이후 도착하는 이전 세션 응답을 무시
  const sessionRef = useRef(0);
  // analyze가 준 브리프·전송 이미지 — variant 재시도와 hero 호출에 재사용
  const briefRef = useRef<NailBrief | null>(null);
  const imagesRef = useRef<{ data: string; mimeType: string }[]>([]);
  /**
   * 지금 보고 있는 시안을 만들 때 쓴 옵션.
   *
   * 착용샷은 이 값으로 만들어야 한다. 결과 화면의 재설정 픽커(shape/length state)를
   * 그대로 넘기면, 픽커만 스퀘어로 바꾸고 재생성은 안 한 사용자가 아몬드 팁셋을 보면서
   * 스퀘어 착용샷을 받는다 — 조용히 틀린 산출물이 나가고 쿼터도 소모된다.
   */
  const genOptionsRef = useRef<{ shape: NailShape; length: NailLength }>({
    shape: 'almond',
    length: 'medium',
  });
  // 진행 중 요청 취소용
  const abortRef = useRef<AbortController | null>(null);
  // 파일 선택 트리거 — 사진 0장에서도 CTA가 활성이어야 하므로 버튼이 이 input을 연다
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showInline = useCallback((text: string) => setError({ text, kind: 'inline' }), []);
  const showToast = useCallback((text: string) => setError({ text, kind: 'toast' }), []);

  useEffect(() => {
    if (phase === 'start' && anchorToolRef.current) {
      anchorToolRef.current = false;
      document.getElementById('tool')?.scrollIntoView({ behavior: 'instant', block: 'start' });
    } else if (phase === 'analyzing' || phase === 'generating' || phase === 'result') {
      // 전체 뷰 전환 — 스토리의 스크롤 위치가 남아 화면이 중간에서 시작하는 것 방지
      window.scrollTo(0, 0);
    }
  }, [phase]);

  /**
   * 화면이 바뀌면 새 화면의 제목으로 포커스를 옮긴다.
   *
   * 버튼을 누르면 그 버튼을 포함한 트리가 통째로 언마운트되면서 포커스가 <body>로
   * 떨어졌다(전 구간 실측). 키보드 사용자는 "무료로 시안 만들기"를 누른 순간 포커스를
   * 잃고, 8초 대기 화면의 취소 버튼에 닿으려면 문서 처음부터 Tab을 다시 해야 했다.
   * 스크린리더 입장에서는 화면이 바뀐 사실 자체가 전달되지 않는다(특히 한도 도달 화면은
   * 라이브 리전이 0개라 완전 무음이었다).
   */
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (phase === 'start') return;
    headingRef.current?.focus();
  }, [phase]);

  const phaseTitle =
    phase === 'analyzing'
      ? '사진 분석 중'
      : phase === 'generating'
        ? '시안 생성 중'
        : phase === 'result'
          ? '시안 결과'
          : '오늘 생성 한도 도달';

  // 탭을 여러 개 열어둔 사용자가 어느 탭이 생성 중인지 구분할 수 있게 (2.4.2)
  useEffect(() => {
    document.title =
      phase === 'start' ? '이달아 — 이달의 네일 아트' : `${phaseTitle} · 이달아`;
  }, [phase, phaseTitle]);

  /** 각 화면 최상단에 두는 시각적 숨김 제목 — 포커스 착지점 겸 헤딩 구조의 뿌리 */
  const screenHeading = (
    <h1 className="visually-hidden" tabIndex={-1} ref={headingRef}>
      {phaseTitle}
    </h1>
  );

  // 토스트만 자동 소멸한다. 인라인 배너는 사용자가 다음 행동을 결정할 때까지 남는다.
  useEffect(() => {
    if (!error || error.kind !== 'toast') return;
    const t = setTimeout(() => setError(null), 6000);
    return () => clearTimeout(t);
  }, [error]);

  // 시작 화면 잔여 횟수 (GET /api/analyze — 조회만, 차감 없음)
  useEffect(() => {
    void fetchGate().then((g) => {
      setRemaining(g.remaining);
      setInviteOn(g.inviteRequired);
      setGateOpen(!g.inviteRequired || g.hasInvite);
    });
  }, []);

  // 새로고침 복구 — 결과가 있었다면 되살린다 (탭을 닫으면 사라진다)
  useEffect(() => {
    const snap = loadSnapshot<VariantSlot[], Mood | null>();
    if (!snap?.slots?.length) return;
    setSlots(snap.slots);
    setSelectedId(snap.selectedId);
    setMood(snap.mood);
    setShape(snap.shape as NailShape);
    setLength(snap.length as NailLength);
    setPartsIntensity(snap.partsIntensity as PartsIntensity);
    setRestored(true);
    setPhase('result');
  }, []);

  // 결과가 정착하면 스냅샷 저장
  useEffect(() => {
    if (phase !== 'result') return;
    if (!slots.some((s) => s.status === 'done')) return;
    saveSnapshot({ slots, selectedId, mood, shape, length, partsIntensity });
  }, [phase, slots, selectedId, mood, shape, length, partsIntensity]);

  const addPhotos = useCallback(
    async (files: File[]) => {
      const freeSlots = MAX_PHOTOS - photos.length;
      if (freeSlots <= 0) return;
      const incoming = files.slice(0, freeSlots);
      // 리사이즈는 저사양 기기에서 수 초가 걸린다 — 선택 즉시 자리를 잡아
      // "선택이 안 됐나?" 하고 다시 누르는 것을 막는다
      setPendingPhotos(incoming.length);
      const settled = await Promise.allSettled(
        incoming.map(async (file) => {
          const payload = await fileToResizedPayload(file);
          return { id: crypto.randomUUID(), ...payload };
        }),
      );
      setPendingPhotos(0);
      const resized = settled
        .filter((s): s is PromiseFulfilledResult<TrayPhoto> => s.status === 'fulfilled')
        .map((s) => s.value);
      // 에러를 각각 setError로 덮어쓰면 앞 메시지가 소실된다 — 하나로 합친다
      const notes: string[] = [];
      if (files.length > freeSlots) notes.push(`사진은 최대 ${MAX_PHOTOS}장까지 올릴 수 있어요`);
      if (resized.length < incoming.length) {
        notes.push('불러올 수 없는 사진이 있어요. JPG·PNG로 다시 시도해주세요');
      }
      if (notes.length) showInline(notes.join(' · '));
      if (resized.length > 0) {
        setPhotos((prev) => [...prev, ...resized].slice(0, MAX_PHOTOS));
      }
    },
    [photos, showInline],
  );

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
          headers: { 'content-type': 'application/json', ...inviteHeaders() },
          body: JSON.stringify({ images: imagesRef.current, brief, plan }),
          signal: abortRef.current?.signal,
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
          showToast('오늘 시안 생성 한도에 도달했어요. 먼저 완성된 시안은 그대로 볼 수 있어요');
          return;
        }
        // REJECTED/502 등 개별 실패 — 이 슬롯만 재시도 버튼으로 (전체를 죽이지 않는다)
        patchSlot(plan.id, { status: 'error' });
      } catch {
        if (sessionRef.current === session) patchSlot(plan.id, { status: 'error' });
      }
    },
    [patchSlot, showToast],
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
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const images = photos.map(({ data, mimeType }) => ({ data, mimeType }));
    imagesRef.current = images;
    briefRef.current = null;
    genOptionsRef.current = { shape, length }; // 착용샷이 참조할 "이 시안을 만든 옵션"
    clearSnapshot();
    setRestored(false); // 새로 만드는 순간 복구본이 아니다
    setSlots([]);
    setSelectedId(null);
    setHeroMap({});
    setMood(null);
    setCraft(null);
    setError(null);
    setPhase('analyzing');
    // 실패로 start에 돌아올 때 사용자를 페이지 최상단이 아니라 툴 카드로 되돌린다.
    // 이 한 줄이 없으면 12초 기다린 뒤 히어로로 튕겨 "초기화됐네" 하고 이탈한다.
    anchorToolRef.current = true;
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...inviteHeaders() },
        body: JSON.stringify({ images, shape, length, partsIntensity }),
        signal: ac.signal,
      });
      const json = await res.json();
      if (sessionRef.current !== session) return;
      if (res.ok) {
        const brief: NailBrief = json.brief;
        const plans: VariantPlan[] = json.plans;
        briefRef.current = brief;
        anchorToolRef.current = false; // 성공했으므로 앵커 복귀는 필요 없다
        setMood({ keywords: brief.keywords ?? [], colors: brief.colors ?? [] });
        setCraft({ difficulty: brief.difficulty, notes: brief.feasibilityNotes });
        setRemaining(json.remaining);
        setSlots(plans.map((plan) => ({ plan, status: 'pending', tipSet: null, quality: null })));
        setPhase('generating');
        // 5개를 병렬 발사 — await 없이 각자 resolve되는 순서대로 슬롯이 채워진다
        plans.forEach((plan) => void fetchVariant(plan, session));
        return;
      }
      if (json.error === 'INVITE_REQUIRED') {
        // 코드가 틀렸거나 만료 — 저장분을 버리고 다시 묻는다
        clearInvite();
        setGateOpen(false);
        setPhase('start');
        anchorToolRef.current = true;
        showInline('초대 코드가 맞지 않아요. 다시 확인해주세요');
        return;
      }
      if (json.error === 'RATE_LIMIT_USER') { setPhase('blocked-user'); return; }
      if (json.error === 'RATE_LIMIT_TOTAL') { setPhase('blocked-total'); return; }
      setPhase('start');
      showInline(
        json.error === 'INVALID_INPUT'
          ? '이 사진으로는 만들기 어려워요. 색과 무드가 잘 보이는 다른 사진으로 시도해주세요'
          : '사진 분석에 실패했어요. 올린 사진은 그대로 있으니 다시 시도해주세요',
      );
    } catch (err) {
      if (sessionRef.current !== session) return;
      // 사용자가 취소한 경우는 에러가 아니다
      if ((err as Error)?.name === 'AbortError') return;
      setPhase('start');
      showInline('사진 분석에 실패했어요. 올린 사진은 그대로 있으니 다시 시도해주세요');
    }
  }, [photos, shape, length, partsIntensity, fetchVariant, showInline]);

  /** 생성 취소 — 사진·옵션은 보존하고 시작 화면으로 */
  const cancelGenerate = useCallback(() => {
    sessionRef.current += 1; // 도착 중인 응답 전부 폐기
    abortRef.current?.abort();
    abortRef.current = null;
    setSlots([]);
    setError(null);
    anchorToolRef.current = true;
    setPhase('start');
  }, []);

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
      setHeroError(null);
      setHeroMap((prev) => ({ ...prev, [planId]: { status: 'loading', image: null } }));
      try {
        const res = await fetch('/api/hero', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...inviteHeaders() },
          body: JSON.stringify({
            images: imagesRef.current,
            tipSet: { image: slot.tipSet.image, mimeType: slot.tipSet.mimeType },
            // 픽커의 현재값이 아니라 이 팁셋을 만든 옵션 — 시안과 착용샷의 쉐입이 갈리면 안 된다
            ...genOptionsRef.current,
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
        setHeroError(
          json.error === 'RATE_LIMIT_HERO'
            ? '오늘 착용샷 생성 한도에 도달했어요. 내일 다시 시도해주세요.'
            : '착용샷 생성에 실패했어요. 다시 시도해도 괜찮아요.',
        );
      } catch {
        if (sessionRef.current !== session) return;
        setHeroMap((prev) => {
          const next = { ...prev };
          delete next[planId];
          return next;
        });
        setHeroError('착용샷 생성에 실패했어요. 다시 시도해도 괜찮아요.');
      }
    },
    [slots, heroMap, showToast], // shape·length는 genOptionsRef로 읽으므로 의존성 아님
  );

  /** 인라인 배너 — 사용자가 보고 있는 자리에 남는다 */
  const inlineError =
    error?.kind === 'inline' ? (
      <div className="error-inline" role="alert">
        <p>{error.text}</p>
        <button className="error-inline-x" aria-label="알림 닫기" onClick={() => setError(null)}>
          ✕
        </button>
      </div>
    ) : null;

  const toastError =
    error?.kind === 'toast' ? (
      <div className="error-toast" role="alert">
        {error.text}
      </div>
    ) : null;

  if (phase === 'start') {
    const hasPhotos = photos.length > 0;
    return (
      <Landing
        toolSlot={
          <>
            <div className="xp-tool-copy">
              <div className="xp-tool-head">
                <span className="xp-pill t-yellow" suppressHydrationWarning>
                  {issue.koShort}
                </span>
                {/* h1은 히어로가 차지 — 툴 섹션 헤드라인은 h2 */}
                <h2>
                  영감 사진을 올리면,
                  <br />
                  이달의 시안이 나와요
                </h2>
              </div>
              {/* 이전 문구("사진을 더할수록 진화해요")는 상한만 말해 3장을 다 올려야
                  하는 것으로 읽혔다 — 최소 1장으로 시작할 수 있음을 먼저 말한다 */}
              <p className="sub">사진 한 장으로 시작해도 돼요. 최대 3장까지 더할 수 있어요.</p>
              <p className="assurance">
                올린 사진은 시안을 만드는 동안에만 쓰고 이달아 서버에 저장하지 않아요.
              </p>
            </div>
            <div className="xp-tool-form">
              {inlineError}
              {/* 게이트가 닫혀 있으면 업로드부터 막는다 — 사진을 다 올리게 한 뒤
                  "사실 못 만들어요"라고 하는 건 최악의 순서다 */}
              {!gateOpen ? (
                <form
                  className="invite-gate"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const code = inviteInput.trim();
                    if (!code) return;
                    setInvite(code);
                    setGateOpen(true);
                    setError(null);
                  }}
                >
                  <label className="invite-label" htmlFor="invite-code">
                    지금은 초대받은 분만 시안을 만들 수 있어요
                  </label>
                  <p className="assurance">
                    코드가 없어도 아래 시안 예시는 모두 실제로 만들어 검수를 통과한 결과물이에요.
                  </p>
                  <div className="notify-row">
                    <input
                      id="invite-code"
                      className="notify-input"
                      type="text"
                      required
                      autoComplete="off"
                      placeholder="초대 코드"
                      value={inviteInput}
                      onChange={(e) => setInviteInput(e.target.value)}
                    />
                    <button className="btn-fill" type="submit">
                      확인
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <InspirationTray
                    photos={photos}
                    pendingCount={pendingPhotos}
                    onAdd={addPhotos}
                    onRemove={removePhoto}
                  />
                  {hasPhotos && (
                    <OptionsPicker
                      shape={shape}
                      length={length}
                      partsIntensity={partsIntensity}
                      onShape={setShape}
                      onLength={setLength}
                      onPartsIntensity={setPartsIntensity}
                    />
                  )}
                </>
              )}
              {/* 비활성 버튼은 퍼널에서 지운다. 사진이 없으면 버튼이 파일 선택기를 열어
                  "다음에 필요한 행동"으로 직결된다 — 히어로 CTA로 여기 온 사용자가
                  누를 수 없는 회색 버튼을 만나지 않는다. */}
              {gateOpen && (
                <button
                  className="cta"
                  onClick={hasPhotos ? generate : () => fileInputRef.current?.click()}
                >
                  {hasPhotos ? '무료로 시안 만들기' : '사진 골라서 시작하기'}
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="visually-hidden"
                aria-hidden
                tabIndex={-1}
                onChange={(e) => {
                  const list = e.target.files;
                  if (list?.length) void addPhotos(Array.from(list));
                  e.target.value = '';
                }}
              />
              {/* 잔여를 숨기면 "아껴 쓰려다 아예 안 누르는" 역효과가 난다.
                  보이면 희소성이 행동을 밀어준다 — 알 수 있을 때는 항상 보여준다. */}
              {/* 게이트가 닫혀 있으면 "무료 · N회 남음"은 지킬 수 없는 약속이다 */}
              <p className="remaining">
                {!gateOpen
                  ? '시안 예시는 코드 없이도 볼 수 있어요'
                  : `가입 없이 무료${remaining !== null ? ` · 오늘 ${remaining}회 남음` : ''}`}
              </p>
            </div>
            {toastError}
          </>
        }
      />
    );
  }

  if (phase === 'analyzing' || phase === 'generating') {
    return (
      <main className="screen">
        {screenHeading}
        <GeneratingScreen
          stage={phase === 'analyzing' ? 'analyzing' : 'variants'}
          slots={slots}
          onRetry={retrySlot}
          onSelect={selectVariant}
          onCancel={cancelGenerate}
        />
        {toastError}
      </main>
    );
  }

  if (phase === 'result') {
    return (
      <main className="screen">
        {screenHeading}
        <ResultScreen
          slots={slots}
          selectedId={selectedId}
          heroMap={heroMap}
          mood={mood}
          craft={craft}
          heroError={heroError}
          photos={photos}
          remaining={remaining}
          shape={shape}
          length={length}
          partsIntensity={partsIntensity}
          onShape={setShape}
          onLength={setLength}
          onPartsIntensity={setPartsIntensity}
          onSelect={setSelectedId}
          onRetry={retrySlot}
          onHero={requestHero}
          onEvolve={() => {
            anchorToolRef.current = true;
            setPhase('start');
          }}
          onRegenerate={generate}
          restored={restored}
          onReset={() => {
            clearSnapshot();
            setRestored(false);
            setPhotos([]);
            setSlots([]);
            setSelectedId(null);
            setHeroMap({});
            setMood(null);
            setCraft(null);
            setPhase('start');
          }}
        />
        {toastError}
      </main>
    );
  }

  /**
   * 한도 도달 화면.
   * 이전에는 버튼도 링크도 없는 완전한 막다른 길이어서 브라우저 뒤로가기가
   * 사이트 이탈이었다. 항상 빠져나갈 길을 두고, 매진은 수요 신호이므로
   * 그 자리에서 알림 신청을 받는다.
   */
  const backToStart = () => {
    setError(null);
    setPhase('start');
  };

  const blocked = phase === 'blocked-user'
    ? {
        title: '오늘의 발행이 마감됐어요',
        body: '하루 3회까지 만들 수 있어요. 한국 시간 자정에 다시 채워져요.',
      }
    : {
        title: '이번 호가 매진됐어요',
        body: '오늘 준비된 생성이 모두 끝났어요. 한국 시간 자정에 다시 열려요.',
      };

  return (
    <main className="screen">
      {screenHeading}
      <div className="blocked">
        {/* 한도 도달은 라이브 리전이 0개라 완전 무음이었다 — 상태로 알린다 */}
        <div className="blocked-card" role="status">
          <p className="overline">Sold Out</p>
          <h2 className="headline">{blocked.title}</h2>
          <p className="sub">{blocked.body}</p>
          {notifyDone ? (
            <p className="assurance">알림 신청이 접수됐어요. 다음 호가 열리면 알려드릴게요.</p>
          ) : (
            <form
              className="notify-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (!notifyEmail.trim()) return;
                fetch('/api/track', {
                  method: 'POST',
                  headers: { 'content-type': 'application/json' },
                  body: JSON.stringify({ event: 'notify', email: notifyEmail.trim() }),
                }).catch(() => {});
                setNotifyDone(true);
              }}
            >
              <label className="assurance" htmlFor="notify-email">
                다시 열리면 알려드릴까요?
              </label>
              <div className="notify-row">
                <input
                  id="notify-email"
                  className="notify-input"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="이메일 주소"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                />
                <button className="btn-fill" type="submit">
                  신청
                </button>
              </div>
            </form>
          )}
          <div className="blocked-actions">
            <button className="btn-outline" onClick={backToStart}>
              처음으로
            </button>
            <a className="btn-outline" href="/#top" onClick={backToStart}>
              시안 예시 보기
            </a>
          </div>
        </div>
      </div>
      {toastError}
    </main>
  );
}
