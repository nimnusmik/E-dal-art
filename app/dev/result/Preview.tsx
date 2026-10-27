'use client';

import { useEffect, useState } from 'react';
import ResultScreen from '@/components/ResultScreen';
import type { GeneratedImage, VariantSlot } from '@/app/page';

/** 공개 폴더의 이미지를 ResultScreen이 받는 base64 형태로 */
async function load(url: string): Promise<GeneratedImage> {
  const blob = await (await fetch(url)).blob();
  const data = await new Promise<string>((r) => {
    const fr = new FileReader();
    fr.onload = () => r(String(fr.result).split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return { image: data, mimeType: blob.type || 'image/jpeg' };
}

const PLANS = [
  { id: 'v1', title: 'Angel Plaid', note: 'Pastel watercolor with plaid tips and one pair of wings as the hero.', img: '/looks/angel-plaid-pastel.jpg' },
  { id: 'v2', title: 'Quiet Lace', note: 'Milky base, lace edging on two tips, the rest left to breathe.', img: '/looks/angel-lace.jpg' },
  { id: 'v3', title: 'Cherry Bold', note: 'Glossy cherries carry the set, lace keeps it soft.', img: '/looks/cherry-lace.jpg' },
];

export default function Preview() {
  const [slots, setSlots] = useState<VariantSlot[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>('v1');
  // ?state=drawing 이면 마지막 시안을 "그리는 중", ?state=fail 이면 실패 칸으로
  // 주소창 값은 마운트 후에 읽는다 (렌더 중에 읽으면 hydration 불일치)
  const [state, setState] = useState<string | null | undefined>(undefined);
  useEffect(() => setState(new URLSearchParams(location.search).get('state')), []);

  useEffect(() => {
    if (state === undefined) return;
    Promise.all(PLANS.map((p) => load(p.img))).then((imgs) =>
      setSlots(
        PLANS.map((p, i) => {
          const last = i === PLANS.length - 1;
          return {
            plan: { id: p.id, title: p.title, note: p.note, patternLines: [], partsLine: '', letteringWord: null },
            status: last && state === 'drawing' ? 'pending' : last && state === 'fail' ? 'error' : 'done',
            tipSet: last && state ? null : imgs[i],
            quality: { pass: i !== 1, score: i === 1 ? 6 : 7, maxScore: 8, notes: 'Ten tips with clean watercolor washes and a large wing motif.', issues: i === 1 ? ['Charm count off'] : [] },
          } satisfies VariantSlot;
        }),
      ),
    );
  }, [state]);

  return (
    <main>
      <ResultScreen
        slots={slots}
        selectedId={selectedId}
        heroMap={{}}
        mood={{ keywords: ['dreamy', 'airy', 'soft'], colors: ['#f3d4e2', '#c9d6f2', '#d8c7ef', '#a9e4dc'] }}
        craft={{ difficulty: 'medium', notes: 'Watercolor wash needs two thin layers. Wings are hand-painted with a liner brush.' }}
        heroError={null}
        signedIn
        photos={[{ id: 'p1', data: '', mimeType: 'image/webp', previewUrl: '/hero/insp/wings.webp' }, { id: 'p2', data: '', mimeType: 'image/webp', previewUrl: '/hero/insp/fairycore.webp' }]}
        remaining={2}
        shape="almond"
        length="medium"
        partsIntensity="auto"
        onShape={() => {}}
        onLength={() => {}}
        onPartsIntensity={() => {}}
        onSelect={setSelectedId}
        onRetry={() => {}}
        onHero={() => {}}
        // 입혀보기는 2초 뒤 저장된 결과로 흉내 — 실제 API·비용 없음 (public/dev/tryon.jpg, git 제외)
        onTryOn={async () => {
          await new Promise((r) => setTimeout(r, 2000));
          return load('/dev/tryon.jpg');
        }}
        onEvolve={() => {}}
        onRegenerate={() => {}}
        onReset={() => {}}
      />
    </main>
  );
}
