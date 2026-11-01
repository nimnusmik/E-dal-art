/**
 * 랜딩 히어로 착용 손(public/hero/cutout/hand-after.webp)을 다시 만든다 — Muse Image 1회.
 * 떠 있는 팁 5개(엄지→새끼)를 hand-before 손에 입힌 사진을 그리게 하고, 흰 바탕을 지워 누끼로.
 * 비교(2026-11-01): YouCam 손가락별 합성은 정적 히어로에선 손톱이 납작·어긋남, gpt-image는 정사각형으로 잘림.
 * Muse가 손 자세·구도를 유지하면서 광택·두께 있는 '시술한 손톱'을 가장 잘 그렸다. 입체 장미(tip-1)는 뺐다.
 * 실행: npx tsx --env-file=.env.local scripts/make-hero-hand.mts [출력.webp]
 */
import sharp from 'sharp';
import { callMuseImage } from '../lib/museimage';

const out = process.argv[2] ?? 'public/hero/cutout/hand-after.webp';
const dir = 'public/hero/cutout';
const TIPS = ['tip-2', 'tip-3', 'tip-4', 'tip-6', 'tip-7']; // 엄지 → 새끼
const PROMPT =
  'Professional nail salon result photo. The hand from the first image, same pose and framing, now wearing the five press-on gel nails from the second image: ' +
  'left to right in the second image = thumb, index, middle, ring, pinky. Copy each nail design exactly. ' +
  'The nails are real medium-length almond gel extensions with visible thickness, a glossy top coat with soft specular highlights, ' +
  'clean cuticle line, slight C-curve, sitting naturally on each fingertip, not flat paint. ' +
  'Keep skin natural. Pure white background, soft studio light.';

const before = sharp(`${dir}/hand-before.webp`);
const { width: W, height: H } = (await before.metadata()) as { width: number; height: number };
const hand = await before.flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer();
const tips = await Promise.all(TIPS.map((n) => sharp(`${dir}/${n}.webp`).flatten({ background: '#ffffff' }).toBuffer()));
const set = await sharp({ create: { width: 220 * 5 + 60, height: 420, channels: 3, background: '#ffffff' } })
  .composite(tips.map((input, i) => ({ input, left: 60 + i * 220, top: 40 })))
  .jpeg()
  .toBuffer();

const res = await callMuseImage(
  [hand, set].map((b) => ({ data: b.toString('base64'), mimeType: 'image/jpeg' })),
  PROMPT,
);
if (!res.image) throw new Error(res.safetyBlocked ? 'safety' : 'empty');

// 누끼: 흰 바탕과의 거리로 알파 (원본 손 크기에 맞춤)
const rgb = await sharp(Buffer.from(res.image.data, 'base64')).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
const a = Buffer.alloc(W * H);
for (let i = 0; i < W * H; i++) a[i] = Math.min(255, Math.max(0, (765 - rgb[i * 3] - rgb[i * 3 + 1] - rgb[i * 3 + 2] - 18) * 6));
const alpha = await sharp(a, { raw: { width: W, height: H, channels: 1 } }).blur(0.8).extractChannel(0).raw().toBuffer();
await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
  .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
  .webp({ quality: 90 })
  .toFile(out);
console.log('OK →', out);
