import PriceProbe from '@/components/PriceProbe';

/**
 * 랜딩의 구독 수요 측정 지점.
 *
 * 결과 화면에도 같은 장치가 있지만, 초대 게이트가 켜져 있는 동안에는 대부분의 방문자가
 * 결과 화면에 도달하지 못한다. 검증 게이트(방문 대비 가격 클릭률 3%)를 재려면 측정
 * 장치가 누구나 닿는 곳에도 있어야 한다 — 갤러리 바로 뒤에 두어, 실제 검수 통과작을
 * 본 직후에 묻는다.
 */
export default function PriceSection() {
  // id="subscribe" — 게이트 카드·푸터 CTA의 "알림 받기" 탈출구가 여기로 앵커한다
  return (
    <section className="xp-paper xp-price" id="subscribe" aria-label="구독 알림">
      <div className="xp-head">
        <span className="xp-pill t-purple" aria-hidden>
          Subscribe
        </span>
        <h2>매달 이달의 아트를 받아볼까요?</h2>
      </div>
      <div className="xp-price-inner">
        <PriceProbe />
      </div>
    </section>
  );
}
