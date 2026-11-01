/**
 * YouCam Nail Transfer 실호출 확인 (1 unit 차감).
 * 실행: npx tsx --env-file=.env.local scripts/e2e-youcam.mts <손사진> <디자인사진> <출력.jpg>
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { tryOn } from '../lib/tryon';

const [handPath, refPath, out] = process.argv.slice(2);
const load = (p: string) => ({ data: readFileSync(p).toString('base64'), mimeType: 'image/jpeg' });
const t0 = Date.now();
const img = await tryOn(load(handPath), load(refPath));
writeFileSync(out, Buffer.from(img.data, 'base64'));
console.log(`OK ${((Date.now() - t0) / 1000).toFixed(1)}s → ${out} (${img.mimeType})`);
