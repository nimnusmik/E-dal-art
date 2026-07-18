import type { CSSProperties } from 'react';

/** 4-스포크 스파클 (레퍼런스의 가늘고 긴 곡선 스포크) */
export function Sparkle({
  size = 18,
  color = 'var(--accent)',
  style,
}: {
  size?: number;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <svg
      className="sparkle"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      style={style}
      aria-hidden
    >
      <path d="M12 0 C13.2 7.8 16.2 10.8 24 12 C16.2 13.2 13.2 16.2 12 24 C10.8 16.2 7.8 13.2 0 12 C7.8 10.8 10.8 7.8 12 0 Z" />
    </svg>
  );
}

/** 12각 스타버스트 (브랜드 배지 뒤 배경) */
export function Starburst({ className = '' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="currentColor" aria-hidden>
      <polygon points="120,60 96.7,69.8 112,90 86.9,86.9 90,112 69.8,96.7 60,120 50.2,96.7 30,112 33.1,86.9 8,90 23.3,69.8 0,60 23.3,50.2 8,30 33.1,33.1 30,8 50.2,23.3 60,0 69.8,23.3 90,8 86.9,33.1 112,30 96.7,50.2" />
    </svg>
  );
}

const START_SPARKLES: { top?: string; bottom?: string; left?: string; right?: string; size: number; color: string }[] = [
  { top: '9%', right: '6%', size: 24, color: 'var(--accent)' },
  { top: '26%', left: '3%', size: 15, color: 'var(--blue)' },
  { top: '44%', right: '4%', size: 18, color: 'var(--lilac)' },
  { bottom: '26%', left: '6%', size: 14, color: 'var(--accent)' },
  { bottom: '13%', right: '9%', size: 20, color: 'var(--blue)' },
];

const COMPACT_SPARKLES = START_SPARKLES.slice(0, 3);

/** 화면 모서리 스파클 장식 레이어 (pointer-events 없음, 순수 장식) */
export default function DecorLayer({ variant = 'start' }: { variant?: 'start' | 'compact' }) {
  const sparkles = variant === 'start' ? START_SPARKLES : COMPACT_SPARKLES;
  return (
    <div className="decor-layer" aria-hidden>
      {sparkles.map(({ size, color, ...pos }, i) => (
        <Sparkle key={i} size={size} color={color} style={pos} />
      ))}
    </div>
  );
}
