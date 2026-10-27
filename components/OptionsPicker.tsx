'use client';

import { useState } from 'react';
import type { NailShape, NailLength } from '@/lib/types';
import type { PartsIntensity } from '@/app/page';

const SHAPES: { value: NailShape; label: string }[] = [
  { value: 'almond', label: 'Almond' },
  { value: 'round', label: 'Round' },
  { value: 'square', label: 'Square' },
  { value: 'stiletto', label: 'Stiletto' },
];

const LENGTHS: { value: NailLength; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'medium', label: 'Medium' },
  { value: 'long', label: 'Long' },
];

// 파츠 강도 — auto: 사진의 파츠 밀도 그대로 / none: 파츠 0 / point: 포인트 1~2개 / rich: 화려하게
// 라벨만으로는 차이를 알 수 없어 선택 시 한 줄 설명을 노출한다
const PARTS: { value: PartsIntensity; label: string; note: string }[] = [
  { value: 'auto', label: 'As photo', note: 'Matches how much charm work is in your photos.' },
  { value: 'none', label: 'Clean', note: 'No stones or charms, just color and art.' },
  { value: 'point', label: 'Accent', note: 'Charms on one or two nails as an accent.' },
  { value: 'rich', label: 'Rich', note: 'Plenty of charms for a full, dimensional look.' },
];

export default function OptionsPicker({
  shape,
  length,
  partsIntensity,
  onShape,
  onLength,
  onPartsIntensity,
}: {
  shape: NailShape;
  length: NailLength;
  partsIntensity: PartsIntensity;
  onShape: (s: NailShape) => void;
  onLength: (l: NailLength) => void;
  onPartsIntensity: (p: PartsIntensity) => void;
}) {
  const [touched, setTouched] = useState(false);
  return (
    <div className="options">
      <div className="option-group">
        <span className="option-label">Shape</span>
        <div className="option-row" role="group" aria-label="Nail shape">
          {SHAPES.map((s) => (
            <button
              key={s.value}
              className={`pill${shape === s.value ? ' active' : ''}`}
              aria-pressed={shape === s.value}
              onClick={() => onShape(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="option-group">
        <span className="option-label">Length</span>
        <div className="option-row" role="group" aria-label="Length">
          {LENGTHS.map((l) => (
            <button
              key={l.value}
              className={`pill${length === l.value ? ' active' : ''}`}
              aria-pressed={length === l.value}
              onClick={() => onLength(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
      <div className="option-group">
        <span className="option-label">Charms</span>
        <div className="option-row" role="group" aria-label="Charm level">
          {PARTS.map((p) => (
            <button
              key={p.value}
              className={`pill${partsIntensity === p.value ? ' active' : ''}`}
              aria-pressed={partsIntensity === p.value}
              onClick={() => {
                setTouched(true);
                onPartsIntensity(p.value);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        {/* 마운트 시점에는 낭독하지 않는다 — 결과 화면에서 이 픽커가 새로 붙으면
            사용자가 건드리지도 않은 파츠 설명이 "생성 완료" 알림 자리를 가로챘다.
            사용자가 실제로 값을 바꿨을 때만 라이브 리전으로 동작시킨다. */}
        <p className="option-note" aria-live={touched ? 'polite' : 'off'}>
          {PARTS.find((p) => p.value === partsIntensity)?.note}
        </p>
      </div>
    </div>
  );
}
