import type { ReactNode } from 'react';

/**
 * 사진 주입 툴을 감싸는 흰 카드 셸.
 * 툴의 상태·핸들러는 app/page.tsx가 소유하고 children으로 주입된다 — 이 컴포넌트는 껍데기다.
 */
export default function ToolSection({ children }: { children: ReactNode }) {
  return (
    <section className="xp-paper xp-tool" id="tool" aria-label="시안 만들기">
      <div className="xp-tool-card">{children}</div>
    </section>
  );
}
