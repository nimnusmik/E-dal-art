import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * 환불 정책.
 *
 * 14일은 Paddle 구매자 약관(EU·UK 14일)과 전자상거래법 청약철회(7일)를 모두 덮는 기간이다.
 * "한 번도 안 썼으면 전액" 하나로 단순하게 둔다 — 조건이 복잡하면 분쟁이 된다.
 */

export const metadata: Metadata = {
  title: '환불 정책 — 이달아',
  robots: { index: true, follow: true },
};

const UPDATED = '2026년 10월 4일';
const CONTACT = 'kimsunmin0227@gmail.com';

export default function RefundPage() {
  return (
    <main className="legal">
      <p className="overline">Refunds</p>
      <h1 className="headline">환불 정책</h1>
      <p className="assurance">최종 수정일: {UPDATED}</p>

      <section>
        <h2>1. 전액 환불</h2>
        <p className="sub">
          결제 후 14일 이내이고 이용권을 한 번도 사용하지 않았다면 전액 환불해 드립니다.
        </p>
      </section>

      <section>
        <h2>2. 사용한 이용권</h2>
        <p className="sub">
          디지털 서비스 특성상, 한 번이라도 사용한 이용권은 환불되지 않습니다. 다만 서비스
          오류로 정상적인 이용이 불가능했다면 사용 여부와 관계없이 남은 횟수만큼 환불해
          드립니다. 만들기에 실패한 회차는 처음부터 차감되지 않습니다.
        </p>
      </section>

      <section>
        <h2>3. 신청 방법</h2>
        <p className="sub">
          로그인한 구글 계정 이메일과 함께 아래 주소로 요청해 주세요. 영업일 3일 이내에
          처리합니다.
          <br />
          <a className="legal-link" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
        </p>
        <p className="sub">
          결제는 Paddle.com이 처리하므로, 환불 금액은 Paddle을 통해 결제하신 수단으로
          돌아갑니다. 결제 영수증 메일의 안내를 통해 Paddle에 직접 요청하실 수도 있습니다.
        </p>
      </section>

      <section>
        <h2>4. 탈퇴 전 확인</h2>
        <p className="sub">
          탈퇴하면 계정과 함께 남은 횟수도 즉시 삭제되어 되돌릴 수 없습니다. 환불 대상
          이용권이 있다면 탈퇴 전에 먼저 신청해 주세요.
        </p>
      </section>

      <p className="legal-back">
        <Link className="btn-link" href="/terms">
          이용약관 보기
        </Link>
      </p>
    </main>
  );
}
