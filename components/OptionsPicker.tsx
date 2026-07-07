'use client';

import type { NailShape, NailLength } from '@/lib/types';

const SHAPES: { value: NailShape; label: string }[] = [
  { value: 'almond', label: '아몬드' },
  { value: 'round', label: '라운드' },
  { value: 'square', label: '스퀘어' },
  { value: 'stiletto', label: '스틸레토' },
];

const LENGTHS: { value: NailLength; label: string }[] = [
  { value: 'short', label: '짧게' },
  { value: 'medium', label: '중간' },
  { value: 'long', label: '길게' },
];

export default function OptionsPicker({
  shape,
  length,
  onShape,
  onLength,
}: {
  shape: NailShape;
  length: NailLength;
  onShape: (s: NailShape) => void;
  onLength: (l: NailLength) => void;
}) {
  return (
    <div className="options">
      <div className="option-group">
        <span className="option-label">손톱 모양</span>
        <div className="option-row">
          {SHAPES.map((s) => (
            <button
              key={s.value}
              className={`pill${shape === s.value ? ' active' : ''}`}
              onClick={() => onShape(s.value)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="option-group">
        <span className="option-label">길이</span>
        <div className="option-row">
          {LENGTHS.map((l) => (
            <button
              key={l.value}
              className={`pill${length === l.value ? ' active' : ''}`}
              onClick={() => onLength(l.value)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
