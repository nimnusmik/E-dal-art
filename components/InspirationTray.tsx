'use client';

import RetroWindow from '@/components/retro/RetroWindow';
import type { TrayPhoto } from '@/app/page';

const MAX_PHOTOS = 3;

export default function InspirationTray({
  photos,
  onAdd,
  onRemove,
}: {
  photos: TrayPhoto[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  const emptySlots = MAX_PHOTOS - photos.length;
  return (
    <div className="tray">
      {photos.map((photo, i) => (
        <RetroWindow
          key={photo.id}
          title={`PHOTO_0${i + 1}.JPG`}
          className="tray-window"
          onClose={() => onRemove(photo.id)}
          closeLabel="사진 삭제"
        >
          <img src={photo.previewUrl} alt="영감 사진" />
        </RetroWindow>
      ))}
      {emptySlots > 0 && (
        // label이 file input을 감싸는 구조 유지 (클릭→파일선택 동작의 근간)
        <label className="rwin tray-window">
          <span className="rwin-bar" aria-hidden>
            <span className="rwin-dots">▪▪</span>
            <span className="rwin-title">NEW.JPG</span>
            <span className="rwin-x">✕</span>
          </span>
          <span className="rwin-body slot-add">
            <span className="plus" aria-hidden>📁</span>
            <span>{photos.length === 0 ? '사진 추가' : '더 추가'}</span>
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="visually-hidden"
            aria-label="영감 사진 추가"
            onChange={(e) => {
              if (e.target.files?.length) onAdd(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}
      {Array.from({ length: Math.max(0, emptySlots - 1) }).map((_, i) => (
        <div className="slot-ghost" key={`empty-${i}`} aria-hidden />
      ))}
    </div>
  );
}
