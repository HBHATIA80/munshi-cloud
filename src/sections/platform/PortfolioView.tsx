"use client";
import { useState, useTransition } from "react";
import { setActiveTenantAction } from "@/sections/auth/actions";
import { joinShopAction, applyUpgradeAction } from "@/sections/platform/actions";

type M = { tenantId: string; role: string; name: string; slug: string; state: string };
const roleLabel = (r: string) => r === "admin" ? "Owner" : r === "staff" ? "Staff" : "Customer";

export function PortfolioView({ name, isSuper, memberships, joinCodes, pendingUpgrade,
  dues, ordersCount }: {
  name: string;
  isSuper: boolean;
  memberships: M[];
  joinCodes: Record<string, string>;
  pendingUpgrade: boolean;
  dues?: Record<string, number>;
  ordersCount?: Record<string, number>;
}) {
  const [pending, start] = useTransition();
  const [showJoin, setShowJoin] = useState(false);
  const [showApply, setShowApply] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const open = (m: M) => start(async () => {
    await setActiveTenantAction(m.tenantId);
    window.location.href = m.role === "customer" ? "/account" : "/erp";
  });
  const isTrader = memberships.some(m => m.role === "admin" || m.role === "staff");

  const inviteWhatsApp = (m: M, code: string) => {
    const txt = `Join ${m.name} on MunshiCloud! 🙏\n` +
      `1. Sign up at ${window.location.origin}/signup with your mobile number\n` +
      `2. Enter our shop code: ${code}\n` +
      `Then see your ledger, invoices & order online anytime.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(txt)}`, "_blank");
  };

  return (
    <>
      <h2 style={{ marginBottom: 4 }}>Welcome, {name}</h2>
      <p className="mut" style={{ marginBottom: 16 }}>
        Your portfolio — every business you own, work in, or buy from.</p>

      {isSuper && (
        <p style={{ marginBottom: 14 }}>
          <a className="btn blk" href="/sa">Platform administration →</a>
        </p>)}

      <div className="pgrid">
        {memberships.map(m => {
          const code = joinCodes[m.tenantId];
          const isOwnerStaff = m.role === "admin" || m.role === "staff";
          return (
            <div className="pcard" key={m.tenantId} style={{ cursor: "default" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 15 }}>{m.name}</b>
                <span className={"chip " + (m.role === "admin" ? "blu" : m.role === "staff" ? "" : "grn")}>
                  {roleLabel(m.role)}
                </span>
              </div>
              <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>/{m.slug} · {m.state}</div>

              {/* customer: live dues & orders for this shop */}
              {m.role === "customer" && dues?.[m.tenantId] !== undefined && (
                <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <span className={"chip " + ((dues[m.tenantId] ?? 0) > 0 ? "red" : "grn")}>
                    dues ₹{(dues[m.tenantId] ?? 0).toLocaleString("en-IN")}
                  </span>
                  <span className="chip">{ordersCount?.[m.tenantId] ?? 0} orders</span>
                </div>)}

              {/* owner/staff: shop code + WhatsApp invite */}
              {isOwnerStaff && code && (
                <div style={{ marginTop: 10, fontSize: 12.5 }}>
                  <span className="mut">Shop code:</span>{" "}
                  <b className="mono" style={{ fontSize: 14, letterSpacing: 2 }}>{code}</b>
                  <button className="ib" title="Copy code"
                    onClick={() => {
                      navigator.clipboard.writeText(code);
                      setMsg("Shop code copied — share it with your customers.");
                    }}>⧉</button>
                  <div className="mut" style={{ fontSize: 10.5 }}>
                    customers enter this code to link with you
                  </div>
                  <button className="btn sm" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                    onClick={() => inviteWhatsApp(m, code)}>📲 Invite customers (WhatsApp)</button>
                </div>
              )}

              <button className="btn pri sm" style={{ marginTop: 12, width: "100%", justifyContent: "center" }}
                disabled={pending} onClick={() => open(m)}>
                {m.role === "customer" ? "My account & ledgers →" : "Open shop panel →"}
              </button>
            </div>
          );
        })}
        {!memberships.length && (
          <div className="empty">No businesses linked yet — join a shop with a code, or create one below.</div>
        )}
      </div>

      {msg && <p className="pos" style={{ fontSize: 13, marginTop: 12 }}>{msg}</p>}
      {err && <p className="neg" style={{ fontSize: 13, marginTop: 12 }}>{err}</p>}

      <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
        <a className="btn" href="/shop">🛒 Browse the marketplace</a>
        <a className="btn" href="/onboard-biz">＋ Add another business</a>
        {!isTrader && (
          <button className="btn" onClick={() => { setShowJoin(v => !v); setErr(""); setMsg(""); }}>
            🔗 Join a shop with code
          </button>)}
      </div>

      {showJoin && (
        <div className="panel" style={{ marginTop: 14, padding: 16, maxWidth: 420 }}>
          <h3 style={{ fontSize: 15, marginBottom: 8 }}>Join a shop</h3>
          <form action={fd => start(async () => {
            setErr(""); setMsg("");
            const r = await joinShopAction(fd);
            if (r.error) setErr(r.error);
            else {
              setMsg("Linked with " + r.shop + " — find it in your portfolio.");
              setShowJoin(false);
              setTimeout(() => location.reload(), 900);
            }
          })}>
            <label className="fl">Shop code</label>
            <input className="inp mono" name="code" placeholder="e.g. 4F7B2C" maxLength={6} required
              style={{ letterSpacing: 3, textTransform: "uppercase" }} />
            <button className="btn pri" style={{ marginTop: 10 }} disabled={pending}>
              {pending ? "Linking…" : "Link this shop"}
            </button>
          </form>
        </div>
      )}

      {!isTrader && (
        <div className="panel" style={{ marginTop: 16, padding: 16, maxWidth: 560 }}>
          <h3 style={{ fontSize: 15 }}>Want to sell? Get your own shop panel.</h3>
          <p className="mut" style={{ fontSize: 12.5, margin: "6px 0 10px" }}>
            Apply to the platform team. Once approved, you get a full POS — invoices,
            stock, your own customers — under this same login.</p>
          {pendingUpgrade
            ? <span className="chip amb">Application pending review</span>
            : showApply ? (
              <form action={fd => start(async () => {
                setErr(""); setMsg("");
                const r = await applyUpgradeAction(fd);
                if (r.error) setErr(r.error);
                else {
                  setMsg("Application sent — we'll review it shortly.");
                  setShowApply(false);
                  setTimeout(() => location.reload(), 900);
                }
              })}>
                <label className="fl">Your business name</label>
                <input className="inp" name="biz" required />
                <div style={{ height: 8 }} />
                <label className="fl">What will you sell? (optional)</label>
                <input className="inp" name="note" placeholder="Mobile spares, accessories…" />
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button type="button" className="btn sm" onClick={() => setShowApply(false)}>Cancel</button>
                  <button className="btn pri sm" disabled={pending}>Submit application</button>
                </div>
              </form>)
            : <button className="btn sm" onClick={() => setShowApply(true)}>
                Apply for a shopkeeper account
              </button>}
        </div>
      )}
    </>
  );
}