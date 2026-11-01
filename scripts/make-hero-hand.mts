/**
 * 랜딩 히어로 착용 손(public/hero/cutout/hand-after.webp)을 다시 만든다 — Muse Image 1회.
 * 떠 있는 팁 5개(엄지→새끼)를 hand-before 손에 입힌 사진을 그리게 하고, 흰 바탕을 지워 누끼로.
 * 비교(2026-11-01): YouCam 손가락별 합성은 정적 히어로에선 손톱이 납작·어긋남, gpt-image는 정사각형으로 잘림.
 * Muse가 손 자세·구도를 유지하면서 광택·두께 있는 '시술한 손톱'을 가장 잘 그렸다. 입체 장미(tip-1)는 뺐다.
 * 실행: npx tsx --env-file=.env.local scripts/make-hero-hand.mts [출력.webp]
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
import { callMuseImage } from '../lib/museimage';
import { mergeMasks, segment } from '../lib/sam';

const out = process.argv[2] ?? 'public/hero/cutout/hand-after.webp';
const dir = 'public/hero/cutout';
const TIPS = ['tip-2', 'tip-3', 'tip-4', 'tip-6', 'tip-7']; // 엄지 → 새끼
const PROMPT =
  'Professional nail salon result photo. The hand from the first image, same pose and framing, now wearing the five press-on gel nails from the second image: ' +
  'left to right in the second image = thumb, index, middle, ring, pinky. Copy each nail design exactly. ' +
  'The nails are real long almond gel extensions that extend clearly past the fingertips (free edge about half the nail bed length) with visible thickness, a glossy top coat with soft specular highlights, ' +
  'clean cuticle line, slight C-curve, sitting naturally on each fingertip, not flat paint. Each nail is exactly as wide as its own nail bed and never overhangs the side of the finger, including the thumb. ' +
  'Keep skin natural. Pure white background, soft studio light.';

// 맨손 원본은 ref/hero에 — public의 hand-before는 이 스크립트가 착용 손과 같은 배율로 만든다(겹쳐 바뀌는 연출)
const before = sharp('ref/hero/hand-before-src.webp');
const { width: W, height: H0 } = (await before.metadata()) as { width: number; height: number };
// 가운데 손가락이 사진 위끝에 닿아 있어 긴 손톱을 그릴 자리가 없다 — 위에 여백을 붙여 그리고, 끝에 원래 크기로 줄여 넣는다
const PAD = Math.round(H0 * 0.12);
const H = H0 + PAD;
const hand = await before.clone().flatten({ background: '#ffffff' }).extend({ top: PAD, background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer();
// 팁 사진은 뾰족한 끝(손톱 끝)이 아래 — 손가락은 위를 향하니 180도 돌려야 프렌치·레이스가 손톱 끝에 온다
const tips = await Promise.all(TIPS.map((n) => sharp(`${dir}/${n}.webp`).rotate(180).flatten({ background: '#ffffff' }).toBuffer()));
const set = await sharp({ create: { width: 220 * 5 + 60, height: 420, channels: 3, background: '#ffffff' } })
  .composite(tips.map((input, i) => ({ input, left: 60 + i * 220, top: 40 })))
  .jpeg()
  .toBuffer();

// 둘째 인자로 이전 원본(ref/hero-hand-raw.png)을 주면 Muse를 다시 안 부르고 누끼만 다시 한다
const reuse = process.argv[3];
const res = reuse
  ? { image: { data: readFileSync(reuse).toString('base64') } }
  : await callMuseImage([hand, set].map((b) => ({ data: b.toString('base64'), mimeType: 'image/jpeg' })), PROMPT);
if (!res.image) throw new Error('Muse 결과 없음');

// 누끼: SAM으로 손을 통째로. 색(흰색과의 거리)으로 지우면 밝은 피부가 반투명해져 등고선 얼룩 + 하얀 테두리가 남았다
const raw = Buffer.from(res.image.data, 'base64');
writeFileSync('ref/hero-hand-raw.png', raw); // 누끼만 다시 할 때 재사용
const rgb = await sharp(raw).resize(W, H, { fit: 'fill' }).removeAlpha().jpeg({ quality: 95 }).toBuffer();
// SAM 'hand'는 손톱과 손목을 뺀다 → 손 ∪ 손톱 ∪ 원래 누끼의 아래 20%(손목, 자세가 같아 그대로 맞음)
const img = { data: rgb.toString('base64'), mimeType: 'image/jpeg' };
const [hands, nails] = await Promise.all([segment(img, 'hand'), segment(img, 'fingernail')]);
if (hands.length === 0) throw new Error('SAM이 손을 못 찾음');
const m = mergeMasks([...hands, ...nails], W, H);
const wrist = await before.clone().extractChannel(3).extend({ top: PAD, background: '#000000' }).raw().toBuffer();
const px = await sharp(rgb).raw().toBuffer();
for (let i = Math.floor(H * 0.8) * W; i < W * H; i++) {
  // Muse 팔이 원래보다 살짝 가늘면 그 틈이 흰 띠로 남는다 — 흰색에 가까운 픽셀은 제외
  const nearWhite = px[i * 3] + px[i * 3 + 1] + px[i * 3 + 2] > 720;
  if (!nearWhite) m[i] = Math.max(m[i], wrist[i]);
}
const alpha = await sharp(Buffer.from(m), { raw: { width: W, height: H, channels: 1 } })
  .erode(2) // 경계 2px 안쪽으로 — 흰 바탕이 섞인 가장자리 제거
  .blur(0.8)
  .extractChannel(0)
  .raw()
  .toBuffer();
// 가장자리 색 정리: Muse가 흰 바탕에 그려서 윤곽 몇 px가 '피부+흰색' 섞인 밝은 색이다(+투명 픽셀은 흰 RGB라 축소 때 번짐).
// 경계 4px 안쪽(확실한 피부)만 '아는 색'으로 두고, 바깥으로 한 칸씩 이웃 평균 색을 밀어낸다(팽창 채색) — 밝은 테두리 제거
const known = await sharp(Buffer.from(m), { raw: { width: W, height: H, channels: 1 } }).erode(4).extractChannel(0).raw().toBuffer();
// SAM 마스크가 실제 손보다 몇 px 크다 — 경계 10px 띠 안의 흰색에 가까운 픽셀은 '모르는 색'으로 (바탕이 묻어 들어온 것)
const core = await sharp(Buffer.from(m), { raw: { width: W, height: H, channels: 1 } }).erode(10).extractChannel(0).raw().toBuffer();
// 기준 = 밝고 색이 옅음(채도 낮음). 밝기만 보면 손톱 테두리 흰 선이 남고, 노랑·민트 손톱은 채도가 높아 안 걸린다
for (let i = 0; i < W * H; i++) {
  if (!known[i] || core[i]) continue;
  const [r, g, b] = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
  if (r + g + b > 600 && Math.max(r, g, b) - Math.min(r, g, b) < 45) known[i] = 0;
}
// 바탕 흰색 걷어내기: SAM 마스크가 손톱 끝에서 바탕을 10px 넘게 물고 들어온다 (실측: 253,253,253 / 불투명도 200).
// 투명 영역에서 출발해 '거의 순백' 픽셀로만 번지는 채우기 — 바깥과 이어진 흰색만 지우고, 손톱 안 하이라이트는 남는다
const isWhite = (i: number) => {
  const [r, g, b] = [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]];
  return r + g + b > 720 && Math.max(r, g, b) - Math.min(r, g, b) < 20;
};
const queue: number[] = [];
for (let i = 0; i < W * H; i++) if (!alpha[i]) queue.push(i);
while (queue.length) {
  const i = queue.pop()!;
  const x = i % W;
  for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
    if (j < 0 || j >= W * H || !alpha[j] || !isWhite(j)) continue;
    alpha[j] = 0;
    known[j] = 0;
    queue.push(j);
  }
}
const fixed = Buffer.from(px);
for (let step = 0; step < 12; step++) {
  const next: number[] = [];
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (known[i]) continue;
      let r = 0, g = 0, b = 0, n = 0;
      for (const j of [i - 1, i + 1, i - W, i + W]) if (known[j]) { r += fixed[j * 3]; g += fixed[j * 3 + 1]; b += fixed[j * 3 + 2]; n++; }
      if (n) { fixed[i * 3] = r / n; fixed[i * 3 + 1] = g / n; fixed[i * 3 + 2] = b / n; next.push(i); }
    }
  for (const i of next) known[i] = 255;
}
const tall = await sharp(fixed, { raw: { width: W, height: H, channels: 3 } })
  .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
  .png()
  .toBuffer();
// 원래 크기(W×H0)에 맞춰 줄이고 좌우를 투명으로 채움 — 히어로 레이아웃이 이 크기를 가정
const w = Math.round((W * H0) / H);
const fit = async (img: Buffer, file: string) =>
  sharp(await sharp(img).resize(w, H0).toBuffer())
    .extend({ left: Math.floor((W - w) / 2), right: Math.ceil((W - w) / 2), background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .webp({ quality: 90 })
    .toFile(file);
await fit(tall, out);
// 맨손도 같은 여백·배율로 — 두 장이 정확히 겹쳐야 손톱만 바뀌어 보인다
const bare = await before.clone().extend({ top: PAD, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await fit(bare, out.replace('hand-after', 'hand-before'));
console.log('OK →', out);
