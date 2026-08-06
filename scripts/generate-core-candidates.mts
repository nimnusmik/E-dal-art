/**
 * 코어 실측 — 코어별로 팁셋 후보를 뽑아 헌법이 작동하는지 눈으로 확인한다.
 *
 * 사용법:
 *   npx tsx scripts/generate-core-candidates.mts <사진경로> <코어id...> [--attach] [--n=3] [--dry]
 * 예:
 *   npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --n=3
 *   npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --attach --n=3
 *   npx tsx scripts/generate-core-candidates.mts ref/trendy/IMG_6259.jpg decoden --n=1 --dry   (프롬프트만 출력, 과금 없음)
 *
 * 합격 기준(스펙 8절 3단계): 코어당 n장 중 1장이라도 "이 코어답다"가 나오면 통과.
 * 그 컷이 UI 카드용 샘플 이미지가 된다.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_ROOT = 'ref/results/core-candidates';

function printUsage(): void {
  console.error('사용법: npx tsx scripts/generate-core-candidates.mts <사진경로> <코어id...> [--attach] [--n=3] [--dry]');
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(1);
  }

  const flags = argv.filter((a) => a.startsWith('--'));
  const positional = argv.filter((a) => !a.startsWith('--'));

  const [photoPath, ...coreIds] = positional;
  if (!photoPath || coreIds.length === 0) {
    printUsage();
    process.exit(1);
  }

  const attach = flags.includes('--attach');
  const dry = flags.includes('--dry');
  const nFlag = flags.find((f) => f.startsWith('--n='));
  const count = nFlag ? Number(nFlag.slice(4)) : 3;

  const { getCore } = await import('../lib/core');
  const { extractPhotoTake } = await import('../lib/photoTake');
  const { composeBrief, buildCorePrompt } = await import('../lib/compose');
  const { fallbackPlansForCore } = await import('../lib/brief');
  const { generateImage } = await import('../lib/provider');

  const buffer = await readFile(photoPath);
  const mimeType = photoPath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const photoPayload = { data: buffer.toString('base64'), mimeType };

  console.log(`사진 분석 중: ${photoPath}`);
  const take = await extractPhotoTake([photoPayload]);
  if (!take) {
    console.error('사진 분석 실패 — GEMINI_API_KEY를 확인하세요.');
    process.exit(1);
  }
  console.log(`  팔레트: ${take.palette.map((p) => `${p.nameEn} ${Math.round(p.ratio * 100)}%`).join(', ')}`);
  console.log(`  모티프: ${take.motifs.map((m) => `${m.name}(${m.material})`).join(', ') || '없음'}`);
  console.log(`  앵커: ${take.fidelityAnchors.join(' / ')}`);

  for (const coreId of coreIds) {
    const core = getCore(coreId);
    if (!core) {
      console.error(`코어 없음: ${coreId}`);
      continue;
    }

    const suffix = attach ? 'attach' : 'noattach';
    const outDir = path.join(OUT_ROOT, `${coreId}-${suffix}`);
    if (!dry) await mkdir(outDir, { recursive: true });

    const plans = fallbackPlansForCore(core);
    const records: Array<{ file: string; planId: string; planTitle: string; prompt: string }> = [];

    console.log(`\n[${core.nameKo}] ${count}장 생성 (사진첨부: ${attach ? 'O' : 'X'}${dry ? ', dry-run' : ''})`);

    for (let i = 0; i < count; i++) {
      const plan = plans[i % plans.length];
      const brief = {
        ...composeBrief(core, take, { shape: 'almond', length: 'medium', partsIntensity: 'auto' }),
        patternLines: plan.patternLines,
        letteringWord: plan.letteringWord,
      };
      const prompt = buildCorePrompt(brief);

      if (dry) {
        console.log(`\n  ── ${i + 1}/${count} (${plan.title}) ──`);
        console.log(prompt);
        continue;
      }

      // D6 실측 — attachPhoto 플래그에 따라 원본 첨부 여부를 바꾼다
      const refs = attach ? [photoPayload] : [];
      const outcome = await generateImage(refs, prompt);

      if (!outcome.image) {
        console.log(`  ${i + 1}/${count} 실패 (safetyBlocked=${outcome.safetyBlocked})`);
        continue;
      }
      const file = `${coreId}-${suffix}-${String(i + 1).padStart(2, '0')}.png`;
      await writeFile(path.join(outDir, file), Buffer.from(outcome.image.data, 'base64'));
      records.push({ file, planId: plan.id, planTitle: plan.title, prompt });
      console.log(`  ${i + 1}/${count} → ${file} (${plan.title})`);
    }

    if (dry) continue;

    await writeFile(
      path.join(outDir, 'manifest.json'),
      JSON.stringify({ coreId, attach, photoPath, photoTake: take, records }, null, 2),
    );

    const report = [
      `# ${core.nameKo} 실측 (사진첨부: ${attach ? 'O' : 'X'})`,
      '',
      `- 원본 사진: \`${photoPath}\``,
      `- 생성 ${records.length}/${count}장`,
      `- 합격 기준: 1장이라도 "이 코어답다"가 나오면 통과`,
      '',
      '## 판정',
      '',
      '| 파일 | 변주 | 코어다움 | 메모 |',
      '|---|---|---|---|',
      ...records.map((r) => `| ${r.file} | ${r.planTitle} | ⬜ | |`),
      '',
      '## 프롬프트 (1번)',
      '',
      '```',
      records[0]?.prompt ?? '(생성 없음)',
      '```',
    ].join('\n');
    await writeFile(path.join(outDir, 'REPORT.md'), report);
    console.log(`  리포트: ${path.join(outDir, 'REPORT.md')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
