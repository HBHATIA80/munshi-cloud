import { getSession } from "@/lib/auth";
import { CompatSection } from "@/sections/compat/CompatSection";

export default async function Landing() {
  const s = await getSession();
  return (
    <div id="wrap">
      <div className="tb">
        <a className="brand" href="/">Munshi<em>Cloud</em></a>
        <a className="nl" href="/shop">Shop</a>
        <a className="nl" href="/compat">Part finder</a>
        <span style={{ flex: 1 }} />
        {s ? <a className="nl" href="/portfolio">My portfolio</a> : <>
          <a className="nl" href="/login">Log in</a>
          <a className="nl on" href="/biz-signup">Start free</a></>}
      </div>

      <section style={{ maxWidth: 1080, margin: "60px auto 26px", padding: "0 24px", textAlign: "center" }}>
        <h1 style={{ fontSize: "clamp(34px,5.5vw,54px)", lineHeight: 1.08 }}>
          Run your shop.<br />Sell online.<br />
          <span style={{ fontStyle: "italic", color: "var(--brand)" }}>Know your numbers.</span></h1>
        <p className="mut" style={{ fontSize: 17, maxWidth: 640, margin: "18px auto 0" }}>
          The business platform for mobile-parts and accessories traders — GST invoicing,
          stock, ledgers and your own online store, in one login. One account holds all
          your businesses, suppliers and shops you buy from.</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 26, flexWrap: "wrap" }}>
          {!s && <>
            <a className="btn pri" href="/biz-signup" style={{ fontSize: 15, padding: "12px 22px" }}>
              Start free — create your business</a>
            <a className="btn" href="/signup" style={{ fontSize: 15, padding: "12px 22px" }}>
              I'm shopping — create a buyer account</a>
            <a className="btn" href="/login" style={{ fontSize: 15, padding: "12px 22px" }}>Log in</a>
          </>}
          {s && <a className="btn pri" href="/portfolio" style={{ fontSize: 15, padding: "12px 22px" }}>
            Open my portfolio →</a>}
        </div>
        <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
          Free to start · No card needed · Works on phone &amp; desktop
        </p>
      </section>

      {/* ===== Part Compatibility Checker — hero band ===== */}
      <section style={{ maxWidth: 1080, margin: "26px auto 40px", padding: "0 24px",
        position: "relative", zIndex: 5 }}>
        {/* decorative layer — the ONLY element with overflow hidden */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 22,
          background: "var(--dark)", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: -60, right: -40, fontSize: 180,
            opacity: .07, transform: "rotate(-12deg)" }}>📱</div>
          <div style={{ position: "absolute", bottom: -70, left: -30, fontSize: 170,
            opacity: .06, transform: "rotate(10deg)" }}>🔋</div>
        </div>

        {/* content — no overflow clipping, so the search dropdown opens freely */}
        <div style={{ position: "relative", padding: "36px 26px", textAlign: "center", color: "#f2edde" }}>
          <span style={{ display: "inline-block", background: "rgba(255,255,255,.14)",
            color: "#fff", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
            letterSpacing: ".08em", padding: "5px 14px", textTransform: "uppercase" }}>
            ✦ Free tool · no login needed</span>
          <h2 style={{ fontSize: "clamp(24px,3.6vw,34px)", margin: "14px auto 8px", maxWidth: 640 }}>
            Which part fits <span style={{ fontStyle: "italic", color: "var(--brand)" }}>your phone?</span></h2>
          <p style={{ color: "#b8b3a0", fontSize: 14.5, maxWidth: 520, margin: "0 auto 20px" }}>
            Type your model — instantly see every display, battery, camera or flex
            that matches, and every other phone sharing the same part.</p>

          <div style={{ background: "var(--card, #fff)", border: "1px solid var(--line)",
            borderRadius: 16, padding: 18, maxWidth: 680, margin: "0 auto",
            boxShadow: "0 14px 40px rgba(0,0,0,.25)", position: "relative", zIndex: 10 }}>
            <CompatSection />
          </div>

          <a href="/compat" style={{ display: "inline-block", marginTop: 16,
            color: "#f2edde", fontSize: 13.5, textDecoration: "none",
            borderBottom: "1px dashed rgba(255,255,255,.4)", paddingBottom: 1 }}>
            Open the full part finder →</a>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: "30px auto", padding: "0 24px" }}>
        <div className="pgrid">
          {([
            ["🧾", "GST invoices in seconds", "Toggle GST on or off per bill. CGST/SGST and IGST decided automatically by the buyer's state."],
            ["📦", "Stock that stays true", "Purchases in, sales out, returns reversed — low-stock alerts before you run dry."],
            ["🛒", "Your own online store", "Share a link. Customers order 24×7; every order becomes an invoice in your books."],
            ["👥", "Dual pricing, built in", "Retail and wholesale price lists. Shopkeepers log in and see their trade rates."],
            ["📚", "Ledgers without chasing", "Every party's running balance, receipts, payments — and customers see their own."],
            ["🏢", "One login, many businesses", "Own two shops? Buy from ten suppliers? Everything in one portfolio, switch in a click."],
          ] as const).map(([em, t, d]) => (
            <div className="panel" key={t} style={{ padding: 22 }}>
              <div style={{ fontSize: 30 }}>{em}</div>
              <h3 style={{ margin: "10px 0 6px", fontSize: 16.5 }}>{t}</h3>
              <p className="mut" style={{ fontSize: 13.5, lineHeight: 1.65 }}>{d}</p>
            </div>))}
        </div>
      </section>

      <section style={{ maxWidth: 880, margin: "20px auto 60px", padding: "0 24px" }}>
        <div className="panel" style={{ padding: "30px 28px", background: "var(--dark)", color: "#f2edde", border: 0 }}>
          <h2 style={{ fontSize: 24 }}>Built for the trade. Priced for it too.</h2>
          <p style={{ color: "#b8b3a0", marginTop: 8, fontSize: 14 }}>
            Start on a free trial today. Simple plans per business when you're ready —
            your data stays yours either way.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" }}>
            <a className="btn pri" href={s ? "/portfolio" : "/biz-signup"}>Create your business</a>
            <a className="btn" href="/shop" style={{ background: "rgba(255,255,255,.12)", color: "#fff", borderColor: "transparent" }}>
              See a live shop →</a>
          </div>
        </div>
      </section>

      <div className="foot">© {new Date().getFullYear()} MunshiCloud · GST-ready accounting, inventory &amp; storefront</div>
    </div>
  );
}