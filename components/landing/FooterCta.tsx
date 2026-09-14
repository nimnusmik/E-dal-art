/** 초원 배경 초대형 타이포 CTA. 풋터 바는 <main> 밖 SiteFooter가 소유한다 */
export default function FooterCta() {
  return (
    <section className="xp-meadow xp-footer-cta" aria-label="시안 만들러 가기">
      <div className="xp-footer-inner">
        <span className="xp-pill t-blue">Ready?</span>
        <h2 className="xp-display xp-footer-title">
          이달의 네일을
          <br />
          먼저 만나요
        </h2>
        <a className="xp-cta" href="#tool">
          무료로 시안 만들기
        </a>
      </div>
    </section>
  );
}
