/**
 * How it works — 히어로 바로 아래.
 * 2026-11-01 개편(시안 A '한 장면 무대'): 카드 박스 없이 영감 사진 → 떠 있는 팁 → 손이 한 줄로 이어진다.
 * 히어로의 폴라로이드·팁 누끼·착용 손을 그대로 써서 같은 세계관이 이어지게. 비교 시안: ref/hiw-options.html
 */
const PHOTOS = [
  { src: '/hero/insp/wings.webp', style: { left: '4%', top: '12%', rotate: '-8deg' } },
  { src: '/hero/insp/fairycore.webp', style: { left: '40%', top: '2%', rotate: '4deg', zIndex: 2 } },
  { src: '/hero/insp/dreamy.webp', style: { left: '22%', top: '34%', rotate: '-2deg', zIndex: 3 } },
];
/** 팁 사진은 손톱 끝이 아래 — 150~200도 돌려 끝이 위(손가락 방향)를 향하게 */
const TIPS = [
  { n: 7, style: { left: '6%', top: '14%', rotate: '160deg' } },
  { n: 3, style: { left: '20%', top: '40%', rotate: '200deg' } },
  { n: 4, style: { left: '52%', top: '4%', rotate: '170deg' } },
  { n: 1, style: { left: '38%', top: '50%', rotate: '190deg' } },
  { n: 6, style: { left: '72%', top: '36%', rotate: '150deg' } },
];

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
      <ol className="hw-stage">
        <span className="hw-trail" aria-hidden />
        <li className="hw-zone">
          <div className="hw-art" aria-hidden>
            {PHOTOS.map((p) => (
              <img key={p.src} className="hw-photo" src={p.src} style={p.style} alt="" loading="lazy" decoding="async" />
            ))}
          </div>
          <span className="hw-n">01</span>
          <h3>Drop up to 3 photos</h3>
          <p>Colors and motifs, read across all of them.</p>
        </li>
        <li className="hw-zone">
          <div className="hw-art" aria-hidden>
            {TIPS.map((t) => (
              <img key={t.n} className="hw-tip" src={`/hero/cutout/tip-${t.n}.webp`} style={t.style} alt="" loading="lazy" decoding="async" />
            ))}
          </div>
          <span className="hw-n">02</span>
          <h3>Get three designed sets</h3>
          <p>Ten tips each, quality checked, in 1 to 2 minutes.</p>
        </li>
        <li className="hw-zone is-hand">
          <div className="hw-art" aria-hidden>
            <img className="hw-handimg" src="/hero/cutout/hand-after.webp" alt="" loading="lazy" decoding="async" />
          </div>
          <span className="hw-n">03</span>
          <h3>See them on your own hand</h3>
          <p>YouCam try-on puts each tip on its finger. Only the nails change.</p>
        </li>
      </ol>
    </section>
  );
}
