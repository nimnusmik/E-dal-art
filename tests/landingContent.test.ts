import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { STATS, SERVICES, GALLERY, SCENES, FAQS } from '@/components/landing/content';

const TONES = ['pink', 'blue', 'yellow', 'green', 'purple'];

describe('랜딩 콘텐츠', () => {
  it('통계 카드는 4장이다', () => {
    expect(STATS).toHaveLength(4);
  });

  it('통계 카드의 값과 문구는 비어 있지 않다', () => {
    for (const s of STATS) {
      expect(s.value.trim().length).toBeGreaterThan(0);
      expect(s.label.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('서비스 행은 5개이고 번호가 겹치지 않는다', () => {
    expect(SERVICES).toHaveLength(5);
    const nos = SERVICES.map((s) => s.no);
    expect(new Set(nos).size).toBe(nos.length);
  });

  it('서비스 행은 모두 설명을 갖는다 (클릭 없이 항상 펼쳐 두는 문구)', () => {
    for (const s of SERVICES) {
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('갤러리 컷은 4장이고 src는 /gallery/ 아래 이미지를 가리킨다', () => {
    expect(GALLERY).toHaveLength(4);
    for (const g of GALLERY) {
      expect(g.src).toMatch(/^\/gallery\/.+\.(jpg|webp)$/);
    }
  });

  it('갤러리에 영감 사진(입력물)을 섞지 않는다', () => {
    // 이 섹션의 문구가 "이런 시안이 나와요"이므로, 사용자가 올리는 입력물이 아니라
    // 실제 생성·검수를 통과한 결과물만 실려야 한다.
    for (const g of GALLERY) {
      expect(g.src).not.toContain('/hero/insp/');
    }
  });

  it('갤러리 이미지 파일이 실제로 존재한다', () => {
    for (const g of GALLERY) {
      expect(existsSync(join(process.cwd(), 'public', g.src))).toBe(true);
    }
  });

  it('갤러리 기울기는 -6도에서 6도 사이다', () => {
    for (const g of GALLERY) {
      expect(Math.abs(g.tilt)).toBeLessThanOrEqual(6);
    }
  });

  it('사용 장면 카드는 3장이다', () => {
    expect(SCENES).toHaveLength(3);
    for (const s of SCENES) {
      expect(s.quote.trim().length).toBeGreaterThan(0);
      expect(s.body.trim().length).toBeGreaterThan(0);
    }
  });

  it('FAQ는 모두 물음표로 끝나고 답변이 비어 있지 않다', () => {
    expect(FAQS.length).toBeGreaterThanOrEqual(6);
    for (const f of FAQS) {
      expect(f.q.trim().endsWith('?')).toBe(true);
      // 질문만 있는 FAQ는 불안을 활성화하고 해소를 거부한다
      expect(f.a.trim().length).toBeGreaterThan(10);
    }
  });

  it('가격·횟수·사진 보관은 FAQ에서 반드시 답한다', () => {
    const joined = FAQS.map((f) => `${f.q} ${f.a}`).join('\n');
    expect(joined).toMatch(/무료/);
    expect(joined).toMatch(/3회/);
    expect(joined).toMatch(/저장하지 않아요/);
  });

  it('카피에 "내 손" 표현을 쓰지 않는다 (사용자 손 사진 입력이 없다)', () => {
    const joined = [
      ...STATS.map((s) => `${s.label} ${s.body}`),
      ...SERVICES.map((s) => `${s.label} ${s.body}`),
      ...SCENES.map((s) => `${s.quote} ${s.body}`),
      ...FAQS.map((f) => f.q),
    ].join('\n');
    expect(joined).not.toMatch(/내 손/);
  });

  it('통계 카드 톤은 파스텔 5색 중 하나다', () => {
    for (const s of STATS) expect(TONES).toContain(s.tone);
  });
});
