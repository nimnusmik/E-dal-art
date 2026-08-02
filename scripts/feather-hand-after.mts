/**
 * "변신 후 손" 알파 엣지 계단 현상 후처리 (일회성, 산출물 커밋).
 *   npx tsx scripts/feather-hand-after.mts
 *
 * 배경: 9916b91 시점의 hand-after.webp는 4개 게이트 기준 중 3개(실사 피부, 손톱 부착,
 * 금지 모티프 없음)에 더해 정렬(IoU 0.9765)까지 통과했지만, 알파 채널이 리사이즈/키아웃
 * 과정에서 0/255로 붕괴해 손 외곽선이 계단(지그재그)처럼 보이는 문제가 있었다.
 * 재생성 루프(포즈 드리프트로 정렬이 계속 실패)를 반복하는 대신, 이미 정렬·피부·디자인이
 * 모두 통과한 이 에셋의 알파 채널만 결정적으로 페더링(가우시안 블러)해 계단 현상을 없앤다.
 *
 * 절차: RGBA를 분해 → 알파 채널만 추출해 가우시안 블러(sigma 0.6~0.8) → RGB는 그대로
 * 두고 블러된 알파로만 재결합 → 원본과 동일한 1000×1796으로 webp 저장.
 * RGB 픽셀 값 자체는 건드리지 않으므로 피부 질감·손톱 디자인은 그대로 보존된다.
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// 페더링 입력: 기본값은 public/hero/hand-after.webp(정렬·피부·디자인이 이미 게이트를
// 통과한 상태여야 함 — 예: `git show 9916b91:public/hero/hand-after.webp > public/hero/hand-after.webp`
// 로 먼저 복원). 다른 후보 파일을 페더링하고 싶으면 인자로 경로를 넘긴다.
const SRC = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'public/hero/hand-after.webp');
const OUT = resolve(ROOT, 'public/hero/hand-after.webp');
const SIGMA = 0.7; // 0.6~0.8 권장 범위의 중간값

async function run() {
  const img = sharp(readFileSync(SRC)).ensureAlpha();
  const meta = await img.metadata();
  const W = meta.width!, H = meta.height!;

  // RGB 3채널과 알파 1채널을 분리 추출.
  // 주의: 입력에 이미 알파가 있는 상태에서 `.ensureAlpha().removeAlpha()`를 체이닝하면
  // sharp가 채널 수를 3으로 내리지 않고 4채널 그대로 반환하는 현상을 확인했다(버퍼 스트라이드가
  // 어긋나 그리드 형태로 이미지가 깨짐). ensureAlpha 없이 removeAlpha만 호출해야 3채널이 된다.
  const { data: rgb } = await sharp(SRC).removeAlpha()
    .raw().toBuffer({ resolveWithObject: true });
  const { data: alpha } = await sharp(SRC).ensureAlpha()
    .extractChannel(3)
    .blur(SIGMA)
    .raw().toBuffer({ resolveWithObject: true });

  // RGB(3채널) + 블러된 알파(1채널) 재결합 → RGBA(4채널)
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = alpha[i];
  }

  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .resize(W, H, { fit: 'fill' }) // 크기 보존(트림 없음), no-op이지만 안전장치
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(OUT);
  console.log('페더링 완료:', OUT, `(sigma=${SIGMA})`);
}
run().catch((e) => { console.error('실패:', e.message); process.exit(1); });
