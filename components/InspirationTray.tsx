'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrayPhoto } from '@/app/page';

const MAX_PHOTOS = 3;

/**
 * 영감 사진 트레이.
 *
 * 이전에는 3칸 그리드에 실제 input이 1개뿐이고 나머지 2칸은 `aria-hidden` 장식이었다.
 * 칸이 3개라는 이유만으로 "3번 눌러야 한다"로 읽혀 없는 슬롯을 누르게 만들었으므로,
 * 이제 "추가 버튼 1개 + 올린 사진 썸네일"로만 그리고 남은 장수는 문장으로 알린다.
 *
 * 데스크톱 주 입력 경로(핀터레스트 이미지 끌어놓기 / Ctrl+V)도 함께 지원한다.
 */
export default function InspirationTray({
  photos,
  pendingCount = 0,
  onAdd,
  onRemove,
}: {
  photos: TrayPhoto[];
  /** 리사이즈 중인 장수 — 선택 즉시 자리를 잡아 "선택이 안 됐나?" 재탭을 막는다 */
  pendingCount?: number;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const [dropping, setDropping] = useState(false);
  const dragDepth = useRef(0);
  const used = photos.length + pendingCount;
  const canAdd = used < MAX_PHOTOS;
  const left = MAX_PHOTOS - used;

  const takeFiles = useCallback(
    (list: FileList | null) => {
      if (!list?.length) return;
      const images = Array.from(list).filter((f) => f.type.startsWith('image/'));
      if (images.length) onAdd(images);
    },
    [onAdd],
  );

  // 붙여넣기 — 클립보드 이미지는 파일 선택보다 빠른 경로다
  useEffect(() => {
    if (!canAdd) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) =>
        f.type.startsWith('image/'),
      );
      if (!files.length) return;
      e.preventDefault();
      onAdd(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [canAdd, onAdd]);

  return (
    <div className="tray-block">
      <div
        className={`tray${dropping ? ' is-dropping' : ''}`}
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current += 1;
          if (canAdd) setDropping(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDropping(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          dragDepth.current = 0;
          setDropping(false);
          takeFiles(e.dataTransfer?.files ?? null);
        }}
      >
        {photos.map((photo, i) => (
          <div className="slot" key={photo.id}>
            <img src={photo.previewUrl} alt="영감 사진" />
            <span className="slot-index" aria-hidden>
              {String(i + 1).padStart(2, '0')}
            </span>
            <button className="slot-x" aria-label="사진 삭제" onClick={() => onRemove(photo.id)}>
              ✕
            </button>
          </div>
        ))}
        {Array.from({ length: pendingCount }).map((_, i) => (
          <div className="slot-loading" key={`pending-${i}`} aria-hidden />
        ))}
        {canAdd && (
          // label이 file input을 감싸는 구조 유지 (클릭→파일선택 동작의 근간)
          <label className="slot">
            <span className="slot-add">
              <span className="plus" aria-hidden>＋</span>
              <span>{photos.length === 0 ? '사진 추가' : '더 추가'}</span>
            </span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="visually-hidden"
              aria-label="영감 사진 추가"
              onChange={(e) => {
                takeFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <p className="tray-hint" aria-live="polite">
        {pendingCount > 0
          ? '사진 준비 중...'
          : canAdd
            ? photos.length === 0
              ? '한 장만 올려도 시작할 수 있어요. 끌어다 놓거나 붙여넣어도 돼요.'
              : `${left}장 더 올릴 수 있어요. 사진을 더하면 색과 무드가 섞여요.`
            : '3장까지 다 올렸어요.'}
      </p>
    </div>
  );
}
