import type { Metadata } from 'next';
import Link from 'next/link';

/**
 * 개인정보 처리방침.
 *
 * 이메일을 한 건이라도 저장하면 개인정보보호법상 공개 의무가 생긴다. 그리고 국외 이전
 * 고지는 로그인과 무관하게 **이미** 해당된다 — 업로드한 사진이 이미지 생성 API를 통해
 * 국외로 나가고 있기 때문이다.
 *
 * 여기 적힌 내용은 실제 동작과 일치해야 한다. 코드를 바꾸면 이 문서도 함께 바꿀 것.
 */

export const metadata: Metadata = {
  title: '개인정보 처리방침 — 이달아',
  robots: { index: true, follow: true },
};

const UPDATED = '2026년 9월 15일';

export default function PrivacyPage() {
  return (
    <main className="legal">
      <p className="overline">Privacy</p>
      <h1 className="headline">개인정보 처리방침</h1>
      <p className="assurance">최종 수정일: {UPDATED}</p>

      <section>
        <h2>1. 수집하는 항목과 목적</h2>
        <table className="legal-table">
          <thead>
            <tr>
              <th>항목</th>
              <th>목적</th>
              <th>보유 기간</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>구글 계정 식별자, 이메일 주소</td>
              <td>로그인, 이용 한도 관리</td>
              <td>탈퇴 시까지</td>
            </tr>
            <tr>
              <td>접속 IP 주소</td>
              <td>비로그인 이용 한도 관리, 남용 방지</td>
              <td>한국 시간 자정까지 (매일 자동 삭제)</td>
            </tr>
            <tr>
              <td>업로드한 사진</td>
              <td>시안 생성</td>
              <td>저장하지 않음 (생성 중에만 사용)</td>
            </tr>
          </tbody>
        </table>
        <p className="sub">
          구글 로그인 시 이름과 프로필 사진은 요청하지 않습니다. 구글 액세스 토큰도
          저장하지 않습니다.
        </p>
      </section>

      <section>
        <h2>2. 국외 이전</h2>
        <p className="sub">
          이달아는 해외 서비스를 이용해 운영됩니다. 아래 사업자에게 개인정보가 이전됩니다.
        </p>
        <table className="legal-table">
          <thead>
            <tr>
              <th>받는 자</th>
              <th>국가</th>
              <th>항목</th>
              <th>목적·시기</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Google LLC</td>
              <td>미국</td>
              <td>계정 식별자, 이메일</td>
              <td>로그인 시점, 인증 처리</td>
            </tr>
            <tr>
              <td>Google LLC (Gemini API)</td>
              <td>미국</td>
              <td>업로드한 사진</td>
              <td>시안 생성 시점, 이미지 생성</td>
            </tr>
            <tr>
              <td>Vercel Inc.</td>
              <td>미국</td>
              <td>접속 IP, 접속 기록</td>
              <td>접속 시점, 서비스 호스팅</td>
            </tr>
            <tr>
              <td>Upstash, Inc.</td>
              <td>미국</td>
              <td>이용 한도 카운터</td>
              <td>이용 시점, 한도 관리</td>
            </tr>
          </tbody>
        </table>
        <p className="assurance">
          이전을 원하지 않으시면 서비스 이용을 중단하실 수 있습니다. 다만 이 경우 시안
          생성 기능을 이용할 수 없습니다.
        </p>
      </section>

      <section>
        <h2>3. 이용자의 권리</h2>
        <p className="sub">
          언제든지 본인의 개인정보에 대해 열람·정정·삭제·처리정지를 요구하실 수 있습니다.
          아래 연락처로 알려주시면 지체 없이 처리합니다. 로그아웃만으로도 이 브라우저에
          남은 세션 정보는 삭제됩니다.
        </p>
      </section>

      <section>
        <h2>4. 파기</h2>
        <p className="sub">
          보유 기간이 지나거나 처리 목적이 달성되면 지체 없이 파기합니다. 이용 한도
          카운터는 한국 시간 자정에 자동으로 삭제됩니다. 업로드한 사진은 애초에 저장하지
          않습니다.
        </p>
      </section>

      <section>
        <h2>5. 만 14세 미만</h2>
        <p className="sub">
          이달아는 만 14세 이상만 이용할 수 있습니다. 만 14세 미만 아동의 개인정보는
          수집하지 않습니다.
        </p>
      </section>

      <section>
        <h2>6. 문의</h2>
        <p className="sub">
          개인정보 보호책임자에게 아래 이메일로 문의하실 수 있습니다.
          <br />
          <a className="legal-link" href="mailto:gvaidevelop@gmail.com">
            gvaidevelop@gmail.com
          </a>
        </p>
      </section>

      <section>
        <h2>7. 변경</h2>
        <p className="sub">
          이 방침이 변경되면 이 페이지에 변경 내용과 시행일을 공지합니다.
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
