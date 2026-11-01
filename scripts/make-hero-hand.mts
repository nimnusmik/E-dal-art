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
  'The nails are real medium-length almond gel extensions with visible thickness, a glossy top coat with soft specular highlights, ' +
  'clean cuticle line, slight C-curve, sitting naturally on each fingertip, not flat paint. ' +
  'Keep skin natural. Pure white background, soft studio light.';

const before = sharp(`${dir}/hand-before.webp`);
const { width: W, height: H } = (await before.metadata()) as { width: number; height: number };
const hand = await before.clone().flatten({ background: '#ffffff' }).jpeg({ quality: 95 }).toBuffer();
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
// SAM 'hand'는 손톱과 손목을 뺀다 → 손 ∪ 손톱 ∪ 원래 누끼의 아래 35%(손목, 자세가 같아 그대로 맞음)
const img = { data: rgb.toString('base64'), mimeType: 'image/jpeg' };
const [hands, nails] = await Promise.all([segment(img, 'hand'), segment(img, 'fingernail')]);
if (hands.length === 0) throw new Error('SAM이 손을 못 찾음');
const m = mergeMasks([...hands, ...nails], W, H);
const wrist = await before.clone().extractChannel(3).raw().toBuffer();
for (let i = Math.floor(H * 0.65) * W; i < W * H; i++) m[i] = Math.max(m[i], wrist[i]);
const alpha = await sharp(Buffer.from(m), { raw: { width: W, height: H, channels: 1 } })
  .erode(1) // 경계 1px 안쪽으로 — 흰 바탕이 섞인 가장자리 제거
  .blur(0.8)
  .extractChannel(0)
  .raw()
  .toBuffer();
await sharp(await sharp(rgb).raw().toBuffer(), { raw: { width: W, height: H, channels: 3 } })
  .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
  .webp({ quality: 90 })
  .toFile(out);
console.log('OK →', out);
