/**
 * 랜딩 페이지용 정적 샘플 자산 생성 스크립트 (일회성, 산출물은 커밋).
 *
 *   npx tsx scripts/generate-samples.mts            # 실호출 (API 4회, 소액 과금)
 *   npx tsx scripts/generate-samples.mts --mock     # 드라이런 (목 응답으로 파이프라인 검증)
 *   npx tsx scripts/generate-samples.mts --force    # 기존 산출물 덮어쓰기
 *
 * 산출물: public/samples/showcase-1..3.webp (1600px)
 */
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = resolve(ROOT, 'public/samples');

// ── .env.local 수동 로드 (tsx는 자동 로드하지 않음) ──────────────
for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const args = new Set(process.argv.slice(2).map((a) => a.split('=')[0]));
const FORCE = args.has('--force');

// 목은 --mock일 때만 — .env.local의 개발용 목 플래그가 실수로 적용되는 것 방지
if (!args.has('--mock')) {
  delete process.env.GEMINI_MOCK;
  delete process.env.SEEDREAM_MOCK;
} else {
  process.env.GEMINI_MOCK = '1';
  process.env.SEEDREAM_MOCK = '1';
}

// env 세팅 후에 동적 import (모듈이 env를 읽기 전에 확정)
const { generateImage, imageProvider } = await import('../lib/provider');
const { buildPrompt } = await import('../lib/prompt');
const { DEFAULT_TREND_KEYWORDS } = await import('../config/trends');
const type = await import('../lib/types');
type NailShape = import('../lib/types').NailShape;
type NailLength = import('../lib/types').NailLength;
void type;

function loadInspiration(): { data: string; mimeType: string }[] {
  // 영감 입력(모델 입력용 — 산출물만 공개 자산이 됨)
  const files = ['ref/Nails.jpeg'];
  return files.map((f) => ({
    data: readFileSync(resolve(ROOT, f)).toString('base64'),
    mimeType: 'image/jpeg',
  }));
}

async function generateOrSkip(outPath: string, prompt: string): Promise<Buffer | null> {
  if (existsSync(outPath) && !FORCE) {
    console.log(`↷ 스킵 (존재함): ${outPath}`);
    return null;
  }
  const inspiration = loadInspiration();
  const outcome = await generateImage(inspiration, prompt);
  if (!outcome.image) {
    throw new Error(`생성 실패 (safetyBlocked=${outcome.safetyBlocked}): ${outPath}`);
  }
  return Buffer.from(outcome.image.data, 'base64');
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log(`공급자: ${imageProvider()}${args.has('--mock') ? ' (MOCK)' : ''}`);

  // 쇼케이스 3장 (shape/length 바리에이션)
  const variants: [NailShape, NailLength][] = [
    ['almond', 'medium'],
    ['round', 'short'],
    ['square', 'long'],
  ];
  for (let i = 0; i < variants.length; i++) {
    const [shape, length] = variants[i];
    const out = resolve(OUT_DIR, `showcase-${i + 1}.webp`);
    // 입력 레퍼런스의 인스타 콜라주 레이아웃/UI가 따라 나오는 것 차단
    const prompt =
      buildPrompt(shape, length, DEFAULT_TREND_KEYWORDS, 1) +
      '\n- Output ONE single clean photograph only: no collage, no inset thumbnails, no UI icons, no page indicators, no text or number overlays of any kind.';
    const buf = await generateOrSkip(out, prompt);
    if (buf) {
      await sharp(buf).resize({ width: 1600 }).webp({ quality: 75 }).toFile(out);
      console.log(`✓ ${out}`);
    }
  }

  console.log('완료.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
