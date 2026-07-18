/**
 * 트렌드 키워드 흐르는 배너. 동일 콘텐츠 2회 복제 + translateX(-50%) 루프.
 * 장식 정보라 전체 aria-hidden. 키워드의 프롬프트용 괄호 주석은 제거해 표시.
 */
export default function Marquee({ items }: { items: string[] }) {
  const line = items
    .map((k) => k.replace(/\(.*?\)/g, '').trim().toUpperCase())
    .filter(Boolean)
    .join(' ✦ ');
  const content = `${line} ✦ `;
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        <span>{content}</span>
        <span>{content}</span>
      </div>
    </div>
  );
}
