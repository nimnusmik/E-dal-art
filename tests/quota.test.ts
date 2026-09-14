import { describe, it, expect, beforeEach } from 'vitest';
import {
  getQuota,
  getScopedUsage,
  imageQuotaKey,
  recordMetric,
  reserve,
  scopedQuotaKey,
  totalQuotaKey,
  userQuotaKey,
  type CounterStore,
} from '@/lib/quota';

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
    async decr(key) {
      const next = (map.get(key) ?? 0) - 1;
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
const IP = '1.2.3.4';

describe('getQuota', () => {
  let f: ReturnType<typeof fakeStore>;
  beforeEach(() => {
    f = fakeStore();
  });

  it('기록 없으면 잔여 = 한도', async () => {
    const q = await getQuota(f.store, IP, NOW, 3, 200);
    expect(q).toEqual({ userUsed: 0, totalUsed: 0, userRemaining: 3, totalExhausted: false });
  });

  it('사용량 반영', async () => {
    f.map.set('quota:user:1.2.3.4:20260707', 2);
    f.map.set('quota:total:20260707', 200);
    const q = await getQuota(f.store, IP, NOW, 3, 200);
    expect(q.userRemaining).toBe(1);
    expect(q.totalExhausted).toBe(true);
  });

  it('한도 초과분은 잔여 0으로 클램프', async () => {
    f.map.set('quota:user:1.2.3.4:20260707', 5);
    const q = await getQuota(f.store, IP, NOW, 3, 200);
    expect(q.userRemaining).toBe(0);
  });
});

describe('키 이름', () => {
  it('범위·전역 키가 서로 침범하지 않는다', () => {
    expect(userQuotaKey(IP, NOW)).toBe('quota:user:1.2.3.4:20260707');
    expect(totalQuotaKey(NOW)).toBe('quota:total:20260707');
    expect(scopedQuotaKey('variant', IP, NOW)).toBe('quota:variant:1.2.3.4:20260707');
    expect(scopedQuotaKey('hero', IP, NOW)).toBe('quota:hero:1.2.3.4:20260707');
    expect(imageQuotaKey(NOW)).toBe('quota:image:20260707');
  });
});

describe('reserve — 선점 후 환불', () => {
  let f: ReturnType<typeof fakeStore>;
  beforeEach(() => {
    f = fakeStore();
  });

  it('한도 내면 즉시 차감하고 KST 자정 TTL을 건다', async () => {
    const held = await reserve(f.store, [{ key: 'k', limit: 3, code: 'NOPE' }], NOW);
    expect(held.ok).toBe(true);
    expect(f.map.get('k')).toBe(1);
    // KST 14:00 → 자정까지 36000초, 버퍼 60초
    expect(f.ttls.get('k')).toBe(36060);
  });

  it('TTL은 첫 증가에서만 건다 — 매번 걸면 자정 만료가 계속 밀린다', async () => {
    await reserve(f.store, [{ key: 'k', limit: 3, code: 'NOPE' }], NOW);
    f.ttls.clear();
    await reserve(f.store, [{ key: 'k', limit: 3, code: 'NOPE' }], NOW);
    expect(f.ttls.has('k')).toBe(false);
  });

  it('한도를 넘으면 되돌리고 코드를 알려준다', async () => {
    f.map.set('k', 3);
    const held = await reserve(f.store, [{ key: 'k', limit: 3, code: 'RATE_LIMIT_USER' }], NOW);
    expect(held).toEqual({ ok: false, code: 'RATE_LIMIT_USER' });
    expect(f.map.get('k')).toBe(3); // 증가분 환불됨
  });

  it('뒤 키가 한도를 넘으면 앞 키까지 전부 되돌린다', async () => {
    f.map.set('total', 200);
    const held = await reserve(
      f.store,
      [
        { key: 'user', limit: 3, code: 'RATE_LIMIT_USER' },
        { key: 'total', limit: 200, code: 'RATE_LIMIT_TOTAL' },
      ],
      NOW,
    );
    expect(held).toEqual({ ok: false, code: 'RATE_LIMIT_TOTAL' });
    expect(f.map.get('user')).toBe(0); // 앞선 선점분도 환불
    expect(f.map.get('total')).toBe(200);
  });

  it('release()는 선점한 키를 전부 환불한다 (생성 실패 = 미차감)', async () => {
    const held = await reserve(
      f.store,
      [
        { key: 'user', limit: 3, code: 'A' },
        { key: 'image', limit: 200, code: 'B' },
      ],
      NOW,
    );
    expect(held.ok).toBe(true);
    if (!held.ok) return;
    await held.release();
    expect(f.map.get('user')).toBe(0);
    expect(f.map.get('image')).toBe(0);
  });

  it('동시 요청이 한도를 넘기지 못한다 — 정확히 limit개만 통과', async () => {
    // 기존 "조회 → 생성 → 차감" 구조에서는 잔여 1회로 동시 20발이 전부 통과했다.
    const results = await Promise.all(
      Array.from({ length: 20 }, () => reserve(f.store, [{ key: 'k', limit: 3, code: 'X' }], NOW)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(3);
    expect(f.map.get('k')).toBe(3);
  });
});

describe('getScopedUsage', () => {
  it('기록 없으면 0, reserve 후 증가분 반영', async () => {
    const f = fakeStore();
    expect(await getScopedUsage(f.store, 'variant', IP, NOW)).toBe(0);
    await reserve(f.store, [{ key: scopedQuotaKey('variant', IP, NOW), limit: 18, code: 'X' }], NOW);
    expect(await getScopedUsage(f.store, 'variant', IP, NOW)).toBe(1);
    expect(await getScopedUsage(f.store, 'hero', IP, NOW)).toBe(0); // 범위끼리 독립
  });
});

describe('recordMetric', () => {
  it('이벤트별 일자 카운터 증가 (TTL 없음 — 지표는 보존)', async () => {
    const f = fakeStore();
    await recordMetric(f.store, 'save', NOW);
    await recordMetric(f.store, 'save', NOW);
    await recordMetric(f.store, 'price', NOW);
    expect(f.map.get('metric:save:20260707')).toBe(2);
    expect(f.map.get('metric:price:20260707')).toBe(1);
    expect(f.ttls.size).toBe(0);
  });
});
