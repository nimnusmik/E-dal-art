'use client';

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
      {photos.map((photo) => (
        <div className="slot" key={photo.id}>
          <img src={photo.previewUrl} alt="영감 사진" />
          <button
            className="slot-remove"
            aria-label="사진 삭제"
            onClick={() => onRemove(photo.id)}
          >
            ✕
          </button>
        </div>
      ))}
      {emptySlots > 0 && (
        <label className="slot">
          <span className="slot-add">
            <span className="plus">＋</span>
            <span>{photos.length === 0 ? '사진 추가' : '더 추가'}</span>
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) onAdd(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      )}
      {Array.from({ length: Math.max(0, emptySlots - 1) }).map((_, i) => (
        <div className="slot" key={`empty-${i}`} aria-hidden style={{ opacity: 0.4 }} />
      ))}
    </div>
  );
}
