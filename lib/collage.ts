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
