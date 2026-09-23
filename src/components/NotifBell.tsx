"use client";
import { useEffect, useRef, useState } from "react";

type N = { id: string; kind: string; payload: any; status: string; created_at: string };
const ICONS: Record<string, string> = {
  order_placed: "🧾", order_confirmed: "✅", order_delivered: "📦", order_cancelled: "❌",
  payment_received: "💰", upgrade_approved: "🎉", upgrade_rejected: "📄", invite_added: "👋",
};
const text = (n: N) => {
  const p = n.payload ?? {};
  switch (n.kind) {
    case "order_placed": return `New order ${p.order} — ₹${Number(p.total ?? 0).toLocaleString("en-IN")} from ${p.customer ?? "customer"}`;
    case "order_confirmed": return `Your order ${p.order} is confirmed`;
    case "order_delivered": return `Your order ${p.order} was delivered`;
    case "order_cancelled": return `Your order ${p.order} was cancelled`;
    case "payment_received": return `Payment ₹${Number(p.amount ?? 0).toLocaleString("en-IN")} received (${p.receipt ?? ""})`;
    case "upgrade_approved": return `Approved! Your shop "${p.shop}" is ready`;
    case "upgrade_rejected": return `Your shopkeeper application was declined`;
    case "invite_added": return `You were added as ${p.role === "staff" ? "Staff" : "Customer"} of ${p.tenant}`;
    default: return n.kind;
  }
};

export function NotifBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[]>([]);
  const [unread, setUnread] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/notifications");
      if (!r.ok) return;
      const d = await r.json();
      setItems(d.items ?? []); setUnread(d.unread ?? 0);
    } catch {}
  };
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next && unread > 0) {
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0); load();
    }
  };

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button className="btn" onClick={toggle} title="Notifications">
        🔔{unread > 0 && (
          <span style={{ position: "absolute", top: -6, right: -6, background: "var(--red)",
            color: "#fff", borderRadius: 99, fontSize: 10, fontWeight: 700, padding: "1px 5px" }}>
            {unread}</span>)}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 95, width: 320,
          background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 10,
          boxShadow: "var(--sh)", maxHeight: 360, overflowY: "auto", marginTop: 6 }}>
          {items.map(n => (
            <div key={n.id} style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)",
              fontSize: 13, background: n.status === "queued" ? "var(--brand2)" : "transparent" }}>
              <div>{ICONS[n.kind] ?? "🔔"} {text(n)}</div>
              <div className="mut" style={{ fontSize: 10.5, marginTop: 2 }}>
                {new Date(n.created_at).toLocaleString("en-IN")}</div>
            </div>))}
          {!items.length && <div className="empty" style={{ padding: 18 }}>No notifications yet.</div>}
        </div>)}
    </div>
  );
}