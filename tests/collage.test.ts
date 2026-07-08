import { describe, it, expect } from 'vitest';
import { collageLayout, coverRect, quantizeColors } from '@/lib/collage';

const W = 1080;
const H = 1350;

describe('collageLayout', () => {
  it('장수만큼 사각형 반환', () => {
    expect(collageLayout(1, W, H)).toHaveLength(1);
    expect(collageLayout(2, W, H)).toHaveLength(2);
    expect(collageLayout(3, W, H)).toHaveLength(3);
  });

  it('모든 사각형이 캔버스 안에 있음', () => {
    for (const count of [1, 2, 3] as const) {
      for (const r of collageLayout(count, W, H)) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.size).toBeLessThanOrEqual(W);
        expect(r.y + r.size).toBeLessThanOrEqual(H);
      }
    }
  });

  it('사각형끼리 겹치지 않음', () => {
    const rects = collageLayout(3, W, H);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap =
          a.x < b.x + b.size && b.x < a.x + a.size && a.y < b.y + b.size && b.y < a.y + a.size;
        expect(overlap).toBe(false);
      }
    }
  });

  it('중앙(네일 영역)은 비워둠 — 캔버스 중심점을 덮는 사각형 없음', () => {
    const cx = W / 2;
    const cy = H / 2;
    for (const count of [1, 2, 3] as const) {
      for (const r of collageLayout(count, W, H)) {
        const covers = r.x <= cx && cx <= r.x + r.size && r.y <= cy && cy <= r.y + r.size;
        expect(covers).toBe(false);
      }
    }
  });
});

describe('coverRect', () => {
  it('가로로 넓은 소스 → 좌우 크롭', () => {
    expect(coverRect(2000, 1000, 1000, 1000)).toEqual({ sx: 500, sy: 0, sw: 1000, sh: 1000 });
  });

  it('세로로 긴 소스 → 상하 크롭', () => {
    expect(coverRect(1000, 2000, 1000, 1000)).toEqual({ sx: 0, sy: 500, sw: 1000, sh: 1000 });
  });

  it('비율 일치 → 크롭 없음', () => {
    expect(coverRect(1080, 1350, 1080, 1350)).toEqual({ sx: 0, sy: 0, sw: 1080, sh: 1350 });
  });
});

/** RGBA 픽셀 배열 헬퍼: [r,g,b] 색을 n개 반복 */
function pixels(colors: [number, number, number][], repeats: number[]): Uint8ClampedArray {
  const out: number[] = [];
  colors.forEach((c, i) => {
    for (let k = 0; k < repeats[i]; k++) out.push(c[0], c[1], c[2], 255);
  });
  return new Uint8ClampedArray(out);
}

describe('quantizeColors', () => {
  it('가장 빈도 높은 색을 우선 반환', () => {
    const data = pixels([[255, 0, 0], [0, 128, 0]], [10, 2]);
    const colors = quantizeColors(data, 2);
    expect(colors[0]).toBe('#f80808'); // 빨강 버킷 대표값 (15,0,0)
    expect(colors).toHaveLength(2);
  });

  it('투명 픽셀은 무시', () => {
    const data = new Uint8ClampedArray([0, 0, 255, 0, 255, 0, 0, 255]); // 파랑(투명) + 빨강(불투명)
    const colors = quantizeColors(data, 3);
    expect(colors).toEqual(['#f80808']); // 불투명 빨강만
  });

  it('요청 개수보다 색이 적으면 있는 만큼만 반환', () => {
    const data = pixels([[255, 0, 0]], [5]);
    expect(quantizeColors(data, 3)).toHaveLength(1);
  });

  it('#RRGGBB 형식', () => {
    const data = pixels([[16, 32, 48]], [3]);
    expect(quantizeColors(data, 1)[0]).toMatch(/^#[0-9a-f]{6}$/);
  });
});
