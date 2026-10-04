import type { Metadata } from 'next';
import Link from 'next/link';
import { PACK_CREDITS, PRICE_REGULAR_KRW } from '@/lib/pricing';

/**
 * 이용약관.
 *
 * Paddle(결제 대행·판매 기록자) 심사 요건: 판매자 이름(개인은 실명 권장), 상품 설명,
 * 가격, 환불 정책·처리방침 링크가 사이트에서 바로 닿아야 한다.
 * 여기 적힌 한도·숫자는 실제 동작과 일치해야 한다 — 코드를 바꾸면 이 문서도 함께 바꿀 것.
 */

export const metadata: Metadata = {
  title: '이용약관 — 이달아',
  robots: { index: true, follow: true },
};

const UPDATED = '2026년 10월 4일';
/** Paddle 심사용 판매자 실명 — 배포 전에 반드시 채운다 */
const SELLER = '[판매자 실명]';
const CONTACT = 'kimsunmin0227@gmail.com';

export default function TermsPage() {
  return (
    <main className="legal">
      <p className="overline">Terms</p>
      <h1 className="headline">이용약관</h1>
      <p className="assurance">최종 수정일: {UPDATED}</p>

      <section>
        <h2>1. 운영자</h2>
        <p className="sub">
          이달아(idala)는 {SELLER}이(가) 개인으로 운영하는 서비스입니다. 문의:{' '}
          <a className="legal-link" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
      </section>

      <section>
        <h2>2. 서비스 내용</h2>
        <p className="sub">
          이달아는 이용자가 올린 영감 사진을 바탕으로 AI가 네일 아트 시안(팁 세트 이미지)과
          손 착용 미리보기 이미지를 만들어 주는 온라인 서비스입니다. 생성된 이미지는 AI가 만든
          참고용 시안이며, 실제 시술 결과와 다를 수 있습니다.
        </p>
      </section>

      <section>
        <h2>3. 이용권과 가격</h2>
        <p className="sub">
          {PACK_CREDITS}회 이용권을 ₩{PRICE_REGULAR_KRW.toLocaleString('ko-KR')}(부가세 포함)에
          판매합니다. 구독이 아니며 한 번 결제로 끝납니다.
        </p>
        <ul className="sub">
          <li>1회 = 시안 세트 1번 만들기 (시안 최대 6장, 착용 미리보기 최대 5장)</li>
          <li>만들기에 실패한 회차는 차감되지 않습니다.</li>
          <li>남은 횟수는 사용 기한이 없습니다.</li>
          <li>남용 방지를 위해 하루 3회까지 사용할 수 있습니다.</li>
        </ul>
      </section>

      <section>
        <h2>4. 결제</h2>
        <p className="sub">
          주문 처리는 온라인 리셀러인 Paddle.com이 담당합니다. Paddle.com은 모든 주문의 판매
          기록자(Merchant of Record)로서 결제, 세금, 영수증, 환불 처리를 맡습니다. 카드 정보 등
          결제 정보는 이달아를 거치지 않습니다.
        </p>
      </section>

      <section>
        <h2>5. 환불</h2>
        <p className="sub">
          환불 조건은{' '}
          <Link className="legal-link" href="/refund">
            환불 정책
          </Link>
          을 따릅니다.
        </p>
      </section>

      <section>
        <h2>6. 생성물과 업로드 사진</h2>
        <p className="sub">
          생성된 이미지는 이용자가 자유롭게 이용할 수 있습니다(매장 홍보 등 상업적 이용 포함).
          업로드하는 사진은 이용자에게 이용 권한이 있는 것이어야 하며, 업로드한 사진은 생성
          중에만 쓰고 저장하지 않습니다. 자세한 내용은{' '}
          <Link className="legal-link" href="/privacy">
            개인정보 처리방침
          </Link>
          을 참고해 주세요.
        </p>
      </section>

      <section>
        <h2>7. 금지 행위</h2>
        <ul className="sub">
          <li>타인의 권리를 침해하거나 불법·선정적인 이미지를 만들려는 행위</li>
          <li>자동화 도구로 서비스를 대량 호출하거나 이용 한도를 우회하는 행위</li>
          <li>계정을 다른 사람과 공유하거나 이용권을 되파는 행위</li>
        </ul>
        <p className="sub">위반 시 이용이 제한될 수 있습니다.</p>
      </section>

      <section>
        <h2>8. 서비스 변경·중단</h2>
        <p className="sub">
          서비스를 종료하게 되면 30일 전에 사이트에 알리고, 남은 횟수는 사용하지 않은 비율만큼
          환불합니다.
        </p>
      </section>

      <section>
        <h2>9. 책임의 한계</h2>
        <p className="sub">
          AI 생성물의 특성상 결과물의 품질·정확성을 보장하지 않습니다. 고의 또는 중대한 과실이
          없는 한, 서비스 이용으로 생긴 간접 손해에 대해서는 책임지지 않습니다. 이 조항은
          관련 법령이 보장하는 소비자의 권리를 제한하지 않습니다.
        </p>
      </section>

      <section>
        <h2>10. 준거법과 변경</h2>
        <p className="sub">
          이 약관은 대한민국 법을 따릅니다. 약관이 바뀌면 이 페이지에 시행일과 함께 공지합니다.
        </p>
      </section>

      <p className="legal-back">
        <Link className="btn-link" href="/">
          ← 이달아로 돌아가기
        </Link>
      </p>
    </main>
  );
}
