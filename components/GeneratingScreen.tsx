'use client';

import { useEffect, useState } from 'react';
import RetroWindow from '@/components/retro/RetroWindow';

const MESSAGES = [
  '사진의 색감을 읽는 중...',
  '어울리는 파츠를 고르는 중...',
  '광택을 올리는 중...',
  '마지막 큐어링 중...',
];

export default function GeneratingScreen() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="generating">
      <RetroWindow title="IDALA.EXE" className="gen-window" barClassName="rwin-bar-blue">
        <div className="rprog" aria-hidden>
          <div className="rprog-fill" />
        </div>
        <div role="status" aria-live="polite">
          <p className="generating-msg" key={index}>
            {MESSAGES[index]}
          </p>
        </div>
      </RetroWindow>
    </div>
  );
}
