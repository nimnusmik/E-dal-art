import { describe, it, expect, beforeEach } from 'vitest';
import { getQuota, recordGeneration, recordMetric, type CounterStore } from '@/lib/quota';

function fakeStore() {
  const map = new Map<string, number>();
  const ttls = new Map<string, number>();
  const store: CounterStore = {
    async get(key) {
      return map.has(key) ? String(map.get(key)) : null;
    },
    async incr(key) {
      const next = (map.get(key) ?? 0) + 1;
      map.set(key, next);
      return next;
    },
    async expire(key, seconds) {
      ttls.set(key, seconds);
    },
  };
  return { store, map, ttls };
}

const NOW = new Date('2026-07-07T05:00:00Z'); // KST 14:00

describe('getQuota', () => {
  let f: ReturnType<typeof fakeStore>;
  beforeEach(() => { f = fakeStore(); });

  it('기록 없으면 잔여 = 한도', async () => {
    const q = await getQuota(f.store, '1.2.3.4', NOW, 3, 200);
    expect(q).toEqual({ userUsed: 0, totalUsed: 0, userRemaining: 3, totalExhausted: false });
  });

  it('사용량 반영', async () => {
    f.map.set('quota:user:1.2.3.4:20260707', 2);
    f.map.set('quota:total:20260707', 200);
    const q = await getQuota(f.store, '1.2.3.4', NOW, 3, 200);
    expect(q.userRemaining).toBe(1);
    expect(q.totalExhausted).toBe(true);
  });

  it('한도 초과분은 잔여 0으로 클램프', async () => {
    f.map.set('quota:user:1.2.3.4:20260707', 5);
    const q = await getQuota(f.store, '1.2.3.4', NOW, 3, 200);
    expect(q.userRemaining).toBe(0);
  });
});

describe('recordGeneration', () => {
  it('사용자·전체 카운터 증가 + KST 자정 TTL 설정', async () => {
    const f = fakeStore();
    await recordGeneration(f.store, '1.2.3.4', NOW);
    expect(f.map.get('quota:user:1.2.3.4:20260707')).toBe(1);
    expect(f.map.get('quota:total:20260707')).toBe(1);
    // KST 14:00 → 자정까지 36000초, 버퍼 60초
    expect(f.ttls.get('quota:user:1.2.3.4:20260707')).toBe(36060);
    expect(f.ttls.get('quota:total:20260707')).toBe(36060);
  });
});

describe('recordMetric', () => {
  it('이벤트별 일자 카운터 증가 (TTL 없음 — 지표는 보존)', async () => {
    const f = fakeStore();
    await recordMetric(f.store, 'save', NOW);
    await recordMetric(f.store, 'save', NOW);
    await recordMetric(f.store, 'evolve', NOW);
    expect(f.map.get('metric:save:20260707')).toBe(2);
    expect(f.map.get('metric:evolve:20260707')).toBe(1);
    expect(f.ttls.size).toBe(0);
  });
});
