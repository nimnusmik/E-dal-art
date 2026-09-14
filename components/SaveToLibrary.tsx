'use client';

import { useState } from 'react';

/**
 * 결과 화면의 "보관함에 저장".
 *
 * 파일 다운로드와 다른 점을 분명히 한다 — 다운로드는 기기에, 이건 계정에 남는다.
 * 한 번 저장한 시안은 버튼을 완료 상태로 바꿔 중복 저장을 막는다(같은 이미지가
 * 두 장 쌓이면 보관함 상한만 축낸다).
 */

type State = 'idle' | 'saving' | 'saved' | 'full' | 'error';

export default function SaveToLibrary(props: {
  image: string;
  mimeType: string;
  title: string;
  note: string | null;
  shape: string;
  length: string;
  quality: unknown;
  mood: unknown;
}) {
  const [state, setState] = useState<State>('idle');

  const save = async () => {
    setState('saving');
    try {
      const res = await fetch('/api/designs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(props),
      });
      if (res.ok) return setState('saved');
      setState(res.status === 409 ? 'full' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'saved') {
    return <p className="assurance save-done">보관함에 담았어요. 다음에 와도 남아 있어요.</p>;
  }

  return (
    <div className="save-library">
      <button className="btn-outline" onClick={() => void save()} disabled={state === 'saving'}>
        {state === 'saving' ? '저장하는 중...' : '보관함에 저장'}
      </button>
      {state === 'full' && (
        <p className="assurance">보관함이 가득 찼어요. 오래된 시안을 지우고 다시 시도해주세요.</p>
      )}
      {state === 'error' && (
        <p className="assurance">저장에 실패했어요. 잠시 뒤 다시 시도해주세요.</p>
      )}
    </div>
  );
}
