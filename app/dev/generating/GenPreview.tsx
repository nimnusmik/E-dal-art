'use client';

import { useEffect, useState } from 'react';
import GeneratingScreen from '@/components/GeneratingScreen';
import type { GeneratedImage, VariantSlot } from '@/app/page';

async function load(url: string): Promise<GeneratedImage> {
  const blob = await (await fetch(url)).blob();
  const data = await new Promise<string>((r) => {
    const fr = new FileReader();
    fr.onload = () => r(String(fr.result).split(',')[1]);
    fr.readAsDataURL(blob);
  });
  return { image: data, mimeType: blob.type || 'image/jpeg' };
}

const IMGS = ['/looks/angel-plaid-pastel.jpg', '/looks/angel-lace.jpg', '/looks/cherry-lace.jpg'];

export default function GenPreview() {
  // 주소창 값은 렌더 중에 읽으면 서버·클라이언트 화면이 갈린다(hydration) — 마운트 후에 읽는다
  const [stage, setStage] = useState<'analyzing' | 'variants'>('analyzing');
  const [done, setDone] = useState(0);
  const [slots, setSlots] = useState<VariantSlot[]>([]);
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setStage(q.get('stage') === 'variants' ? 'variants' : 'analyzing');
    setDone(Number(q.get('done') ?? 0));
  }, []);

  useEffect(() => {
    if (stage === 'analyzing') return;
    Promise.all(IMGS.map(load)).then((imgs) =>
      setSlots(
        IMGS.map((_, i) => ({
          plan: { id: `v${i + 1}`, title: ['Angel Plaid', 'Quiet Lace', 'Cherry Bold'][i], patternLines: [], partsLine: '', letteringWord: null },
          status: i < done ? 'done' : 'pending',
          tipSet: i < done ? imgs[i] : null,
          quality: null,
        })),
      ),
    );
  }, [stage, done]);

  return (
    <main>
      <GeneratingScreen
        stage={stage}
        slots={slots}
        photos={[
          { id: 'p1', data: '', mimeType: 'image/webp', previewUrl: '/hero/insp/wings.webp' },
          { id: 'p2', data: '', mimeType: 'image/webp', previewUrl: '/hero/insp/fairycore.webp' },
          { id: 'p3', data: '', mimeType: 'image/webp', previewUrl: '/hero/insp/dreamy.webp' },
        ]}
        onRetry={() => {}}
        onSelect={() => {}}
        onCancel={() => {}}
      />
    </main>
  );
}
