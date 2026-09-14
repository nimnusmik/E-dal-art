/**
 * 보관함 왕복 점검 — 실제 Neon + Blob에 쓰고 읽고 지운다.
 * 테스트 계정과 이미지는 마지막에 전부 삭제하므로 흔적이 남지 않는다.
 */
import { upsertAccount, deleteAccount } from '../lib/accounts';
import { saveDesign, listDesigns, deleteDesign } from '../lib/designs';

const SUB = `smoke-${crypto.randomUUID()}`;
// 1x1 투명 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const account = await upsertAccount(SUB, 'smoke@example.com');
console.log('1. 계정 생성:', account ? '성공' : '실패');
if (!account) process.exit(1);

const saved = await saveDesign({
  googleSub: SUB,
  imageBase64: PNG,
  mimeType: 'image/png',
  title: '스모크 시안',
  note: '왕복 점검용',
  shape: 'almond',
  length: 'medium',
  quality: { pass: true, score: 6, maxScore: 6, notes: '통과', issues: [] },
  mood: { keywords: ['테스트'], colors: ['#ffffff'] },
});
console.log('2. 시안 저장:', saved.ok ? `성공 (${saved.id})` : `실패 (${saved.reason})`);
if (!saved.ok) { await deleteAccount(SUB); process.exit(1); }

const list = await listDesigns(SUB);
console.log('3. 목록 조회:', `${list.length}장`);
const signed = list[0]?.imageUrl ?? '';
console.log('   서명 URL 발급:', signed.startsWith('http') ? '성공' : '실패');
console.log('   메타 보존:', list[0]?.title === '스모크 시안' && list[0]?.note === '왕복 점검용' ? '성공' : '실패');

if (signed.startsWith('http')) {
  const res = await fetch(signed);
  console.log('   서명 URL 실제 접근:', res.status === 200 ? '200 성공' : `${res.status} 실패`);
}

// 남의 것을 지울 수 없는지
const notMine = await deleteDesign(`other-${crypto.randomUUID()}`, saved.id);
console.log('4. 타인 삭제 차단:', notMine === false ? '성공' : '실패 — 보안 문제');

const removed = await deleteDesign(SUB, saved.id);
console.log('5. 본인 삭제:', removed ? '성공' : '실패');
console.log('   삭제 후 목록:', (await listDesigns(SUB)).length === 0 ? '0장 확인' : '남아 있음');

await deleteAccount(SUB);
console.log('6. 계정 정리: 완료');
