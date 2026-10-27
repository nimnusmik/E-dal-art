/**
 * Muse 전환 E2E — /api/analyze → /api/variant → /api/tryon이 내부에서 부르는 함수를 같은 순서로 호출.
 * 로그인·이용권 차감 없이 실제 Muse(Spark·Image·SAM)만 검증한다.
 * 실행: TEXT_PROVIDER=muse IMAGE_PROVIDER=muse npx tsx scripts/e2e-muse.mts <출력폴더> <손사진.jpg> <영감1> [영감2..]
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';
import { analyzeToBrief, applyOptions, applyPlan, buildBriefPrompt, planVariants } from '../lib/brief';
import { judgeImage, verdictDetail } from '../lib/judge';
import { generateImage } from '../lib/provider';
import { analyzeGenerate } from '../lib/geminiText';
import { tryOn } from '../lib/tryon';

const [out, handPath, ...inspPaths] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const jpeg = async (p: string) => ({ data: (await sharp(p).jpeg().toBuffer()).toString('base64'), mimeType: 'image/jpeg' });
const t0 = Date.now();
const lap = (m: string) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

const images = await Promise.all(inspPaths.map(jpeg));
const raw = await analyzeToBrief(images);
if (!raw) {
  // brief.ts는 오류를 삼키고 null만 준다 — 원인을 보려고 한 번 직접 호출
  await analyzeGenerate({ contents: [{ text: 'Say OK' }] }).then((r) => console.log('직접 호출 응답', r.text), (e) => console.log('직접 호출 오류', String(e)));
  throw new Error('분석 실패');
}
lap(`분석 OK: ${raw.shape}/${raw.length}, 키워드 ${raw.keywords?.join(', ')}`);
const brief = applyOptions(raw, { shape: 'almond', length: 'medium', partsIntensity: 'auto' });
const plans = await planVariants(brief);
lap(`플랜 ${plans.length}개: ${plans.map((p) => p.title).join(' / ')}`);

const merged = applyPlan(brief, plans[0]);
const gen = await generateImage(images, buildBriefPrompt(merged));
if (!gen.image) throw new Error(`생성 실패 safety=${gen.safetyBlocked}`);
writeFileSync(`${out}/tipset.png`, Buffer.from(gen.image.data, 'base64'));
lap('팁셋 생성 OK → tipset.png');
const j = await judgeImage(gen.image, merged);
lap(`검수: ${j ? JSON.stringify(verdictDetail(j, merged)) : '실패(null)'}`);

const hand = await jpeg(handPath);
const result = await tryOn(hand, gen.image);
writeFileSync(`${out}/tryon.jpg`, Buffer.from(result.data, 'base64'));
lap('입혀보기 OK → tryon.jpg');
