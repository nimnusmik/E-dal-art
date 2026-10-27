/**
 * How it works — 히어로 바로 아래 (2026-10-27).
 * 1단계 사진 3장 위로 지나가는 스캔 빛은 생성 중 화면(GeneratingScreen)과 같은 효과 —
 * 랜딩에서 본 장면이 실제 앱에서 그대로 나온다.
 */
const PHOTOS = ['/hero/insp/wings.webp', '/hero/insp/fairycore.webp', '/hero/insp/dreamy.webp'];
const LOOKS = ['/looks/angel-plaid-pastel.jpg', '/looks/angel-lace.jpg', '/looks/cherry-lace.jpg'];

export default function HowItWorks() {
  return (
    <section className="hw" aria-labelledby="hw-title">
      <div className="hw-head">
        <div>
          <p className="hw-eyebrow">How it works</p>
          <h2 id="hw-title" className="hw-title">
            Three photos in, <em>your</em> nails out.
          </h2>
        </div>
        <p className="hw-lede">
          A screenshot, an outfit, today&apos;s sky. Mix up to three, and idala reads the colors and motifs across all of
          them.
        </p>
      </div>
      <ol className="hw-flow">
        <li className="hw-step">
          <span className="hw-num" aria-hidden>01</span>
          <div className="hw-card hw-stack" aria-hidden>
            {PHOTOS.map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
            <span className="hw-scan" />
            <span className="hw-pill">up to 3 photos</span>
          </div>
          <h3>Drop up to 3 photos</h3>
          <p>We read color, motifs and parts across all of them.</p>
        </li>
        <li className="hw-step">
          <span className="hw-num" aria-hidden>02</span>
          <div className="hw-card hw-trio" aria-hidden>
            {LOOKS.map((src) => <img key={src} src={src} alt="" loading="lazy" decoding="async" />)}
          </div>
          <h3>Get three designed sets</h3>
          <p>Each one quality checked, in about a minute.</p>
        </li>
        <li className="hw-step">
          <span className="hw-num" aria-hidden>03</span>
          <div className="hw-card hw-hand" aria-hidden>
            <img src="/hero/cutout/hand-after.webp" alt="" loading="lazy" decoding="async" />
            <span className="hw-pill">your hand</span>
          </div>
          <h3>Try it on your own hand</h3>
          <p>Upload a hand photo. Only the nails change.</p>
        </li>
      </ol>
    </section>
  );
}
