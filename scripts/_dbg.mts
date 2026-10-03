import { readFileSync } from 'node:fs';
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}
delete process.env.GEMINI_MOCK;
const genai = await import('@google/genai');
const proto = Object.getPrototypeOf(new genai.GoogleGenAI({ apiKey: 'x' }).models);
const orig = proto.generateContent;
proto.generateContent = async function (params: { model: string }) {
  const t = Date.now();
  try {
    const r = await orig.call(this, params);
    console.log(`OK ${params.model} ${Date.now() - t}ms text=${(r.text ?? '').length}자`);
    return r;
  } catch (e) {
    console.log(`ERR ${params.model} ${Date.now() - t}ms`, String(e).slice(0, 400));
    throw e;
  }
};
const { analyzeToBrief } = await import('../lib/brief');
const imgs = ['tattoo', 'dreamy', 'fairycore'].map((n) => ({
  data: readFileSync(`ref/results/pilot-3variants/input/${n}.jpg`).toString('base64'),
  mimeType: 'image/jpeg',
}));
for (let i = 0; i < 3; i++) console.log('결과:', (await analyzeToBrief(imgs)) ? '성공' : '실패');
