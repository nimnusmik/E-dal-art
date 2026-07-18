import type { ReactNode } from 'react';

/**
 * 레트로 OS 윈도우 프레임. onClose가 있으면 타이틀바 ✕가 진짜 버튼,
 * 없으면 장식(aria-hidden) — 가짜 인터랙션을 스크린리더에 노출하지 않는다.
 */
export default function RetroWindow({
  title,
  children,
  className = '',
  barClassName = '',
  onClose,
  closeLabel = '닫기',
}: {
  title: string;
  children: ReactNode;
  className?: string;
  barClassName?: string;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <div className={`rwin ${className}`.trim()}>
      <div className={`rwin-bar ${barClassName}`.trim()}>
        <span className="rwin-dots" aria-hidden>
          ▪▪
        </span>
        <span className="rwin-title">{title}</span>
        {onClose ? (
          <button type="button" className="rwin-x" aria-label={closeLabel} onClick={onClose}>
            ✕
          </button>
        ) : (
          <span className="rwin-x" aria-hidden>
            ✕
          </span>
        )}
      </div>
      <div className="rwin-body">{children}</div>
    </div>
  );
}
