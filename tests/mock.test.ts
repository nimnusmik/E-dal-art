import { describe, it, expect, afterEach, vi } from 'vitest';
import { isMock } from '@/lib/mock';
import { generateImage } from '@/lib/provider';

const FLAGS = ['IMAGE_MOCK', 'GEMINI_MOCK', 'SEEDREAM_MOCK'] as const;

afterEach(() => {
  for (const f of FLAGS) delete process.env[f];
  delete process.env.IMAGE_PROVIDER;
  vi.restoreAllMocks();
});

describe('isMock', () => {
  it('플래그가 하나도 없으면 false', () => {
    expect(isMock()).toBe(false);
  });

  it.each(FLAGS)('%s=1이면 true', (flag) => {
    process.env[flag] = '1';
    expect(isMock()).toBe(true);
  });

  it("'1'이 아닌 값은 무시한다", () => {
    process.env.IMAGE_MOCK = 'true';
    expect(isMock()).toBe(false);
  });
});

describe('목 모드에서는 프로바이더가 밖으로 나가지 않는다', () => {
  // 이 테스트가 존재하는 이유: 프로바이더마다 목 플래그를 따로 묻던 시절,
  // IMAGE_PROVIDER=seedream + GEMINI_MOCK=1 조합에서 실제 Seedream API로
  // 호출이 나갔다. 프로바이더를 추가할 때 같은 구멍이 다시 열리면 여기서 걸린다.
  it.each(['gemini', 'seedream'])('IMAGE_MOCK=1 + IMAGE_PROVIDER=%s', async (provider) => {
    process.env.IMAGE_MOCK = '1';
    process.env.IMAGE_PROVIDER = provider;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const outcome = await generateImage([], 'test prompt');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(outcome.image).not.toBeNull();
    expect(outcome.safetyBlocked).toBe(false);
  });
});
