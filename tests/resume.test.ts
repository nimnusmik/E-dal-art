import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '@/lib/resume';

const KEY = 'idala:result:v2';

function installSessionStorage(): Map<string, string> {
  const map = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  });
  return map;
}

function slot(id: string, status: string, withTip = true) {
  return {
    plan: { id, title: id },
    status,
    tipSet: withTip ? { image: 'aW1n', mimeType: 'image/png' } : null,
    quality: null,
  };
}

const BASE = { selectedId: null, mood: null, shape: 'almond', length: 'medium', partsIntensity: 'auto' };

let store: Map<string, string>;
beforeEach(() => {
  store = installSessionStorage();
});

describe('saveSnapshot / loadSnapshot', () => {
  it('완성된 시안을 되살린다', () => {
    saveSnapshot({ ...BASE, slots: [slot('v1', 'done')], selectedId: 'v1' });
    const snap = loadSnapshot<ReturnType<typeof slot>[], null>();
    expect(snap?.slots).toHaveLength(1);
    expect(snap?.selectedId).toBe('v1');
  });

  it('미완성 슬롯(pending·error)은 버린다 — 되살려도 재시도할 브리프가 없다', () => {
    // 생성 중 카드를 먼저 고르면 pending 슬롯이 포함된 채로 저장된다.
    // 그대로 복구하면 그 카드는 아무 요청도 없이 영영 스켈레톤으로 남는다.
    saveSnapshot({
      ...BASE,
      slots: [slot('v1', 'done'), slot('v2', 'pending', false), slot('v3', 'error', false)],
    });
    const snap = loadSnapshot<ReturnType<typeof slot>[], null>();
    expect(snap?.slots.map((s) => s.plan.id)).toEqual(['v1']);
  });

  it('버려진 슬롯이 선택돼 있었으면 선택을 해제한다', () => {
    saveSnapshot({ ...BASE, slots: [slot('v1', 'done'), slot('v2', 'pending', false)], selectedId: 'v2' });
    expect(loadSnapshot()?.selectedId).toBeNull();
  });

  it('완성분이 하나도 없으면 복구하지 않는다', () => {
    saveSnapshot({ ...BASE, slots: [slot('v1', 'pending', false)] });
    expect(loadSnapshot()).toBeNull();
  });

  it('tipSet 없는 done 슬롯도 버린다', () => {
    saveSnapshot({ ...BASE, slots: [slot('v1', 'done', false)] });
    expect(loadSnapshot()).toBeNull();
  });

  it('저장된 것이 없으면 null', () => {
    expect(loadSnapshot()).toBeNull();
  });
});

describe('손상된 스냅샷 방어', () => {
  it('JSON이 깨졌으면 null (흰 화면 대신)', () => {
    store.set(KEY, '{ not json');
    expect(loadSnapshot()).toBeNull();
  });

  it('slots가 배열이 아니면 null', () => {
    store.set(KEY, JSON.stringify({ ...BASE, slots: 'oops' }));
    expect(loadSnapshot()).toBeNull();
  });

  it('plan.id가 없는 옛 스키마면 null — 캐스팅했으면 TypeError로 화면이 통째로 죽는다', () => {
    store.set(KEY, JSON.stringify({ ...BASE, slots: [{ status: 'done', tipSet: {} }] }));
    expect(loadSnapshot()).toBeNull();
  });

  it('옵션 필드가 없으면 기본값으로 채운다', () => {
    store.set(KEY, JSON.stringify({ slots: [slot('v1', 'done')], selectedId: null }));
    const snap = loadSnapshot();
    expect(snap?.shape).toBe('almond');
    expect(snap?.length).toBe('medium');
    expect(snap?.partsIntensity).toBe('auto');
  });
});

describe('용량 상한', () => {
  it('4MB를 넘으면 저장하지 않는다 (조용히)', () => {
    const huge = { ...slot('v1', 'done'), tipSet: { image: 'x'.repeat(5_000_000), mimeType: 'image/png' } };
    saveSnapshot({ ...BASE, slots: [huge] });
    expect(store.has(KEY)).toBe(false);
  });
});

describe('clearSnapshot', () => {
  it('저장분을 지운다', () => {
    saveSnapshot({ ...BASE, slots: [slot('v1', 'done')] });
    clearSnapshot();
    expect(loadSnapshot()).toBeNull();
  });
});
