"use client";
import { useState } from "react";

type PU = { no: string; date: string; qty: number; rate: number; supplier: string };
type Item = { id: string; name: string; sku?: string };

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

/* button + hover chip for one line: shows last purchase inline */
export function LastPurchaseChip({ purchases, onOpen }: {
  purchases: PU[]; onOpen: () => void }) {
  const last = purchases[0];
  if (!last) return null;
  return (
    <span className="chip" style={{ fontSize: 10.5, cursor: "pointer" }}
      title={`Last purchase: ${inr(last.rate)} × ${last.qty} from ${last.supplier} on ${last.date}`}
      onClick={e => { e.stopPropagation(); onOpen(); }}>
      last buy {inr(last.rate)}
    </span>);
}

/* panel: compare last N purchases across selected items */
export function PriceCompare({ items, byItem, onClose, onPick }: {
  items: Item[];
  byItem: Record<string, PU[]>;          // item_id -> up to 5 purchases (newest first)
  onClose: () => void;
  onPick: (id: string) => void;          // toggle: add (fetch) or remove
}) {
  const [q, setQ] = useState("");
  const shown = Object.keys(byItem);
  const fl = q.trim().toLowerCase();
  const options = items.filter(i =>
    !shown.includes(i.id) &&
    (!fl || i.name.toLowerCase().includes(fl) || (i.sku ?? "").toLowerCase().includes(fl)))
    .slice(0, 8);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 92, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 780, maxWidth: "100%", maxHeight: "92vh",
        overflowY: "auto", overscrollBehavior: "contain", padding: 20 }}>

        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Purchase price comparison — last 5 bills</h3>
          <button className="btn sm" onClick={onClose}>✕ Close</button>
        </div>

        {/* item adder — INLINE list (no absolute dropdown, no nested scroll) */}
        <div style={{ marginBottom: 14 }}>
          <input className="inp" placeholder="Add an item to compare…"
            value={q} onChange={e => setQ(e.target.value)} style={{ maxWidth: 420 }} />
          {q.trim() && options.length > 0 && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 10, marginTop: 6,
              maxHeight: 190, overflowY: "auto", overscrollBehavior: "contain" }}>
              {options.map(i => (
                <button key={i.id} type="button"
                  style={{ display: "flex", width: "100%", textAlign: "left", gap: 8,
                    padding: "8px 12px", border: 0, borderBottom: "1px solid var(--line)",
                    background: "transparent", cursor: "pointer" }}
                  onClick={() => { onPick(i.id); setQ(""); }}>
                  <b style={{ fontSize: 13 }}>{i.name}</b>
                  {i.sku && <span className="mut mono" style={{ fontSize: 11 }}>{i.sku}</span>}
                  <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut, #888)" }}>add →</span>
                </button>))}
            </div>)}
          {q.trim() && !options.length && (
            <p className="mut" style={{ fontSize: 12, marginTop: 6 }}>
              No more items match — all matches may already be in the comparison.</p>)}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
          gap: 12 }}>
          {shown.map(id => {
            const list = byItem[id] ?? [];
            const item = items.find(i => i.id === id);
            const min = list.length ? Math.min(...list.map(p => p.rate)) : 0;
            const max = list.length ? Math.max(...list.map(p => p.rate)) : 0;
            return (
              <div key={id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                  <b style={{ fontSize: 13 }}>{item?.name ?? "Item"}</b>
                  <button className="ib" title="Remove from comparison"
                    onClick={() => onPick(id)}>✕</button>
                </div>
                {list.length > 1 && (
                  <div className="mut" style={{ fontSize: 11, margin: "2px 0 8px" }}>
                    range {inr(min)} – {inr(max)} · last {list.length} bills</div>)}
                <table className="t" style={{ fontSize: 11.5 }}>
                  <thead><tr><th>Bill</th><th>Date</th><th>Qty</th><th className="num">Rate</th></tr></thead>
                  <tbody>
                    {list.map((p, i) => (
                      <tr key={p.no}>
                        <td className="mono" style={{ fontSize: 10.5 }}>{p.no}</td>
                        <td style={{ fontSize: 10.5 }}>{p.date}</td>
                        <td className="num">{p.qty}</td>
                        <td className="num" style={{ fontWeight: i === 0 ? 700 : 400 }}>
                          {inr(p.rate)}{i === 0 && <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
                        </td>
                      </tr>))}
                    {!list.length && <tr><td colSpan={4}><div className="empty">No purchases yet.</div></td></tr>}
                  </tbody>
                </table>
              </div>);
          })}
          {!shown.length && <div className="empty">Add items above to see their last 5 purchase bills.</div>}
        </div>
      </div>
    </div>
  );
}