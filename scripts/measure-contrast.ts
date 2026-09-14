/**
 * 스크린샷에서 텍스트 밴드의 실측 대비를 계산한다.
 *   npx tsx scripts/measure-contrast.ts <png> <y1:y2> [<y1:y2> ...]
 *
 * 글자 픽셀(3채널 모두 밝음)을 제외한 **배경 픽셀만** 골라 휘도 중앙값과
 * 최명부(가장 불리한 지점)를 뽑고 흰 글씨(#fff) 대비를 낸다.
 */
import sharp from 'sharp';

function srgbToLin(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

function contrastVsWhite(L: number): number {
  return 1.05 / (L + 0.05);
}

async function main() {
  const [file, ...bands] = process.argv.slice(2);
  if (!file || bands.length === 0) {
    console.error('usage: tsx scripts/measure-contrast.ts <png> <y1:y2> ...');
    process.exit(1);
  }
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  const { width, channels } = info;

  for (const band of bands) {
    // "y1:y2" 또는 "y1:y2@x1:x2" (특정 가로 구간만)
    const [yPart, xPart] = band.split('@');
    const [y1, y2] = yPart.split(':').map(Number);
    const [x1, x2] = xPart ? xPart.split(':').map(Number) : [0, width];
    const lums: number[] = [];
    for (let y = y1; y < y2; y++) {
      for (let x = x1; x < x2; x++) {
        const i = (y * width + x) * channels;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // 흰 글자·밝은 알약은 배경이 아니다 — 제외
        if (r > 205 && g > 205 && b > 205) continue;
        lums.push(luminance(r, g, b));
      }
    }
    if (!lums.length) { console.log(`${band}: 배경 픽셀 없음`); continue; }
    lums.sort((a, b) => a - b);
    const median = lums[Math.floor(lums.length / 2)];
    const p95 = lums[Math.floor(lums.length * 0.95)]; // 가장 밝은(=가장 불리한) 쪽
    console.log(
      `y ${band}  중앙값 ${contrastVsWhite(median).toFixed(2)}:1  ` +
      `최명부(p95) ${contrastVsWhite(p95).toFixed(2)}:1  (배경 ${lums.length}px)`,
    );
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
