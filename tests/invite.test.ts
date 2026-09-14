import { describe, it, expect, afterEach } from 'vitest';
import { hasValidInvite, inviteRequired } from '@/lib/request';

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/analyze', { method: 'POST', headers });
}

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('초대 게이트', () => {
  it('INVITE_CODES가 비어 있으면 게이트가 꺼진다 (로컬 개발·전체 공개)', () => {
    delete process.env.INVITE_CODES;
    expect(inviteRequired()).toBe(false);
    expect(hasValidInvite(req())).toBe(true);
  });

  it('코드가 있으면 헤더 없는 요청을 막는다', () => {
    process.env.INVITE_CODES = 'idala-2609';
    expect(inviteRequired()).toBe(true);
    expect(hasValidInvite(req())).toBe(false);
  });

  it('유효한 코드는 통과 — 대소문자·공백 무시', () => {
    process.env.INVITE_CODES = 'idala-2609';
    expect(hasValidInvite(req({ 'x-invite-code': 'IDALA-2609' }))).toBe(true);
    expect(hasValidInvite(req({ 'x-invite-code': '  idala-2609  ' }))).toBe(true);
  });

  it('틀린 코드는 막는다', () => {
    process.env.INVITE_CODES = 'idala-2609';
    expect(hasValidInvite(req({ 'x-invite-code': 'nope' }))).toBe(false);
  });

  it('코드를 여러 개 둘 수 있다 (배포 채널별 추적용)', () => {
    process.env.INVITE_CODES = 'a-code, b-code ,c-code';
    for (const c of ['a-code', 'b-code', 'c-code']) {
      expect(hasValidInvite(req({ 'x-invite-code': c }))).toBe(true);
    }
    expect(hasValidInvite(req({ 'x-invite-code': 'd-code' }))).toBe(false);
  });

  it('빈 헤더는 통과시키지 않는다', () => {
    process.env.INVITE_CODES = 'idala-2609';
    expect(hasValidInvite(req({ 'x-invite-code': '   ' }))).toBe(false);
  });
});
