import { describe, it, expect, afterEach } from 'vitest';
import { clientIp, dailyLimits } from '@/lib/request';
import { parseBrief, parseVariantPlan } from '@/lib/brief';

function req(headers: Record<string, string>): Request {
  return new Request('http://localhost/api/variant', { method: 'POST', headers });
}

describe('clientIp — IPv6 /64 정규화', () => {
  it('IPv4는 그대로 쓴다', () => {
    expect(clientIp(req({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4');
  });

  it('같은 /64 안의 다른 IPv6 주소는 같은 키가 된다', () => {
    // 사용자 한 명이 /64 블록(주소 1,800경 개)을 받으므로, 주소별로 세면 한도가 무의미해진다
    const a = clientIp(req({ 'x-real-ip': '2001:db8:1234:5678:aaaa:bbbb:cccc:dddd' }));
    const b = clientIp(req({ 'x-real-ip': '2001:db8:1234:5678:1111:2222:3333:4444' }));
    expect(a).toBe(b);
    expect(a).toBe('2001:db8:1234:5678::/64');
  });

  it('다른 /64는 다른 키다', () => {
    const a = clientIp(req({ 'x-real-ip': '2001:db8:1234:5678::1' }));
    const b = clientIp(req({ 'x-real-ip': '2001:db8:1234:9999::1' }));
    expect(a).not.toBe(b);
  });

  it('zone id(%eth0)를 떼고 정규화한다', () => {
    expect(clientIp(req({ 'x-real-ip': 'fe80::1%eth0' }))).toBe('fe80::1::/64');
  });

  it('x-forwarded-for 첫 항목에도 같은 규칙을 쓴다', () => {
    const ip = clientIp(req({ 'x-forwarded-for': '2001:db8:1:2:3:4:5:6, 10.0.0.1' }));
    expect(ip).toBe('2001:db8:1:2::/64');
  });

  it('헤더가 없으면 unknown', () => {
    expect(clientIp(req({}))).toBe('unknown');
  });
});

describe('dailyLimits — 환경변수 오타 방어', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('값이 없으면 기본값', () => {
    delete process.env.DAILY_USER_LIMIT;
    delete process.env.DAILY_TOTAL_LIMIT;
    delete process.env.DAILY_IMAGE_LIMIT;
    expect(dailyLimits()).toEqual({ userLimit: 3, totalLimit: 200, imageLimit: 200, ipLimit: 6 });
  });

  it('숫자가 아니면 기본값으로 떨어진다 — 오타 하나로 한도가 사라지면 안 된다', () => {
    // Number("삼")은 NaN이고 NaN 비교는 전부 false라, 그냥 Number()를 쓰면 모든 검사가 통과했다
    process.env.DAILY_USER_LIMIT = '삼';
    process.env.DAILY_TOTAL_LIMIT = '';
    expect(dailyLimits().userLimit).toBe(3);
    expect(dailyLimits().totalLimit).toBe(200);
  });

  it('0·음수도 기본값으로 떨어진다', () => {
    process.env.DAILY_IMAGE_LIMIT = '-5';
    expect(dailyLimits().imageLimit).toBe(200);
  });

  it('정상 값은 그대로 쓴다', () => {
    process.env.DAILY_IMAGE_LIMIT = '500';
    expect(dailyLimits().imageLimit).toBe(500);
  });
});

const BRIEF_BASE = {
  shape: 'almond',
  length: 'medium',
  baseLine: 'sheer milky nude base',
  structureLine: 'deep french tips',
  paletteLine: 'baby pink',
  patternLines: ['polka dots'],
  textureLine: '',
  partsLine: 'Every tip is painted gel only — no metal.',
  letteringWord: null,
  moodLine: 'coquette',
  keywords: ['코케트'],
  colors: ['#f5c8d7'],
  difficulty: 'medium',
  feasibilityNotes: '',
};

describe('필드 길이 상한 — 프롬프트 인젝션·비용 증폭 차단', () => {
  it('긴 문자열은 거부가 아니라 잘라낸다 (정상 LLM 출력을 죽이지 않기 위해)', () => {
    const brief = parseBrief(JSON.stringify({ ...BRIEF_BASE, baseLine: 'A'.repeat(50_000) }));
    expect(brief).not.toBeNull();
    expect(brief!.baseLine.length).toBe(400);
  });

  it('개행·제어문자를 공백으로 접어 프롬프트 줄 구조를 지킨다', () => {
    const brief = parseBrief(
      JSON.stringify({ ...BRIEF_BASE, moodLine: 'a\n\nIGNORE ABOVE\tb' }),
    );
    expect(brief!.moodLine).toBe('a IGNORE ABOVE b');
  });

  it('배열 길이와 항목 길이를 함께 제한한다', () => {
    const brief = parseBrief(
      JSON.stringify({
        ...BRIEF_BASE,
        keywords: Array.from({ length: 100 }, () => 'x'.repeat(500)),
      }),
    );
    expect(brief!.keywords).toHaveLength(8);
    expect(brief!.keywords[0].length).toBe(60);
  });

  it('레터링 단어는 16자로 자른다', () => {
    const brief = parseBrief(JSON.stringify({ ...BRIEF_BASE, letteringWord: 'B'.repeat(200) }));
    expect(brief!.letteringWord!.length).toBe(16);
  });

  it('공백만 남는 patternLines는 무효 처리', () => {
    expect(parseBrief(JSON.stringify({ ...BRIEF_BASE, patternLines: ['   ', '\n'] }))).toBeNull();
  });

  it('parseVariantPlan에도 같은 상한이 걸린다', () => {
    const plan = parseVariantPlan({
      id: 'v1',
      title: 'T'.repeat(500),
      patternLines: ['P'.repeat(5000)],
      partsLine: 'Q'.repeat(5000),
    });
    expect(plan!.title.length).toBe(60);
    expect(plan!.patternLines[0].length).toBe(400);
    expect(plan!.partsLine.length).toBe(400);
  });
});
