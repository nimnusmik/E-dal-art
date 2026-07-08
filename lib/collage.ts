export const COLLAGE_WIDTH = 1080;
export const COLLAGE_HEIGHT = 1350; // 4:5, 인스타 세로 비율

export interface Rect {
  x: number;
  y: number;
  size: number;
}

/**
 * 영감 사각형 배치 프리셋 (ref/ 콜라주 형식).
 * 가장자리에 붙여 중앙의 네일이 가려지지 않게 한다.
 */
export function collageLayout(count: 1 | 2 | 3, width: number, height: number): Rect[] {
  const size = Math.round(width * 0.28);
  const m = Math.round(width * 0.045); // 여백
  const topLeft: Rect = { x: m, y: m, size };
  const bottomLeft: Rect = { x: m, y: height - size - m, size };
  const midRight: Rect = { x: width - size - m, y: Math.round((height - size) / 2) + Math.round(height * 0.12), size };
  const bottomRight: Rect = { x: width - size - m, y: height - size - m, size };

  if (count === 1) return [bottomLeft];
  if (count === 2) return [topLeft, bottomRight];
  return [topLeft, midRight, bottomLeft];
}

/** 4비트 버킷 키(0~4095)를 대표 #RRGGBB로 변환 */
function bucketToHex(key: number): string {
  const to = (b: number) => (b * 16 + 8).toString(16).padStart(2, '0');
  return `#${to((key >> 8) & 15)}${to((key >> 4) & 15)}${to(key & 15)}`;
}

/** 두 버킷의 색 차이 (채널 절댓값 합, 0~45) */
function bucketDistance(a: number, b: number): number {
  return (
    Math.abs(((a >> 8) & 15) - ((b >> 8) & 15)) +
    Math.abs(((a >> 4) & 15) - ((b >> 4) & 15)) +
    Math.abs((a & 15) - (b & 15))
  );
}

/**
 * RGBA 픽셀 배열 → 대표 색상 count개(#RRGGBB).
 * 채널당 4비트로 양자화해 빈도순 정렬 후, 서로 충분히 구별되는 색을 우선 선택.
 * 순수 함수 — 단위 테스트 가능.
 */
export function quantizeColors(data: Uint8ClampedArray, count = 3): string[] {
  const freq = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // 투명 픽셀 제외
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const picked: number[] = [];
  for (const key of sorted) {
    if (picked.length >= count) break;
    if (picked.every((p) => bucketDistance(p, key) >= 3)) picked.push(key);
  }
  // 구별되는 색이 부족하면 빈도순으로 채움
  for (const key of sorted) {
    if (picked.length >= count) break;
    if (!picked.includes(key)) picked.push(key);
  }
  return picked.map(bucketToHex);
}

/** 브라우저 전용: 이미지에서 대표 색상 추출 (무드 색상 폴백용) */
export function extractColors(bitmap: ImageBitmap, count = 3): string[] {
  const w = 64;
  const h = Math.max(1, Math.round((bitmap.height / bitmap.width) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0, w, h);
  return quantizeColors(ctx.getImageData(0, 0, w, h).data, count);
}

/** cover-fit: 소스에서 대상 비율에 맞게 중앙 크롭할 영역 */
export function coverRect(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const sw = Math.round(srcH * dstRatio);
    return { sx: Math.round((srcW - sw) / 2), sy: 0, sw, sh: srcH };
  }
  const sh = Math.round(srcW / dstRatio);
  return { sx: 0, sy: Math.round((srcH - sh) / 2), sw: srcW, sh };
}

/** 브라우저 전용: 네일 이미지 + 영감 사진들 → 콜라주 JPEG data URL */
export function drawCollage(nail: ImageBitmap, insets: ImageBitmap[]): string {
  const canvas = document.createElement('canvas');
  canvas.width = COLLAGE_WIDTH;
  canvas.height = COLLAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d context unavailable');

  const bg = coverRect(nail.width, nail.height, COLLAGE_WIDTH, COLLAGE_HEIGHT);
  ctx.drawImage(nail, bg.sx, bg.sy, bg.sw, bg.sh, 0, 0, COLLAGE_WIDTH, COLLAGE_HEIGHT);

  const count = Math.min(insets.length, 3) as 1 | 2 | 3;
  const rects = collageLayout(count, COLLAGE_WIDTH, COLLAGE_HEIGHT);
  insets.slice(0, 3).forEach((inset, i) => {
    const r = rects[i];
    const crop = coverRect(inset.width, inset.height, r.size, r.size);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    // 그림자를 위해 먼저 불투명 사각형을 깔고 그 위에 이미지
    ctx.fillStyle = '#fff';
    ctx.fillRect(r.x, r.y, r.size, r.size);
    ctx.restore();
    ctx.drawImage(inset, crop.sx, crop.sy, crop.sw, crop.sh, r.x, r.y, r.size, r.size);
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}
