'use client';

import { useCallback, useEffect, useState } from 'react';
import InspirationTray from '@/components/InspirationTray';
import OptionsPicker from '@/components/OptionsPicker';
import { fileToResizedPayload } from '@/lib/resize';
import type { Mood, NailLength, NailShape } from '@/lib/types';

export interface TrayPhoto {
  id: string;
  data: string;
  mimeType: string;
  previewUrl: string;
}

export interface GenerationResult {
  image: string; // base64
  mimeType: string;
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
    const incoming = Array.from(files);
    const resized = await Promise.all(
      incoming.map(async (file) => {
        const payload = await fileToResizedPayload(file);
        return { id: crypto.randomUUID(), ...payload };
      }),
    );
    setPhotos((prev) => [...prev, ...resized].slice(0, MAX_PHOTOS));
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Task 12에서 구현
  const generate = useCallback(async () => {}, []);

  if (phase === 'start') {
    return (
      <main className="screen">
        <span className="brand">이달아</span>
        <h1 className="headline">
          영감 사진을 올리면,
          <br />
          이달의 네일 아트
          <br />
          시안이 나와요
        </h1>
        <p className="sub">사진을 더할수록 디자인이 진화해요 (최대 3장)</p>
        <InspirationTray photos={photos} onAdd={addPhotos} onRemove={removePhoto} />
        {photos.length > 0 && (
          <OptionsPicker shape={shape} length={length} onShape={setShape} onLength={setLength} />
        )}
        <button className="cta" disabled={photos.length === 0} onClick={generate}>
          네일 디자인 만들기
        </button>
        {remaining !== null && <p className="remaining">오늘 {remaining}회 남음</p>}
        {error && <div className="error-toast">{error}</div>}
      </main>
    );
  }

  // Task 12: generating / Task 13: result / Task 14: blocked 화면
  return <main className="screen" />;
}
