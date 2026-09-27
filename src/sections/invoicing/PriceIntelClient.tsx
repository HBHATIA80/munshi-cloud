"use client";
import { useEffect, useState, useTransition } from "react";
import { itemPurchaseHistoryAction } from "./actions";

type PU = { no: string; date: string; qty: number; rate: number; supplier: string };
type Item = { id: string; name: string; sku: string; cost: number };
type Res = { error?: string } & unknown;

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

type Card = { itemId: string; list: PU[] };

/* Purchase comparison: nothing shown until the user searches an item.
   History is fetched on demand — one item at a time. */
export function PriceIntelClient({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [pending, start] = useTransition();

  const fl = q.trim().toLowerCase();
  const options = fl
    ? items.filter(i => i.name.toLowerCase().includes(fl) ||
        (i.sku ?? "").toLowerCase().includes(fl)).slice(0, 8)
    : [];                                   // nothing until user types

  const add = (id: string) => {
    const name = items.find(i => i.id === id)?.name ?? id;
    setQ(""); setOpen(false);
    // placeholder card while loading
    setCards(cs => cs.some(c => c.itemId === id)
      ? cs
      : [{ itemId: id, list: [] }, ...cs]);
    start(async () => {
      const r = await itemPurchaseHistoryAction(id) as unknown as { error?: string } | PU[];
      if (Array.isArray(r)) {
        setCards(cs => cs.map(c => c.itemId === id ? { itemId: id, list: r } : c));
      } else {
        setCards(cs => cs.filter(c => c.itemId !== id));
        alert(name + ": " + ((r as any).error ?? "could not load history"));
      }
    });
  };

  const remove = (id: string) => setCards(cs => cs.filter(c => c.itemId !== id));

  useEffect(() => {
    const h = (e: MouseEvent) => { /* handled by blur */ };
    return () => {};
  }, []);

  return (
    <>
      <div className="ph" style={{ marginBottom: 10 }}>
        <h2>Purchase price comparison</h2>
        <p className="mut" style={{ fontSize: 12 }}>
          Type an item name — select it to fetch and compare its last 5 purchase bills.</p>
      </div>

      {/* search — plain suggestions (name + sku only), purchase data loads AFTER selection */}
      <div style={{ position: "relative", maxWidth: 560, marginBottom: 16 }}>
        <input className="inp" placeholder="Search item to compare…"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)} />
        {open && fl && options.length > 0 && (
          <div style={{ position: "absolute", zIndex: 70, left: 0, right: 0,
            top: "calc(100% + 4px)", background: "var(--card, #fff)",
            border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,.14)" }}>
            {options.map(i => (
              <button key={i.id} type="button"
                style={{ display: "flex", width: "100%", textAlign: "left", gap: 8,
                  alignItems: "center", padding: "9px 12px", border: 0,
                  borderBottom: "1px solid var(--line)", background: "transparent",
                  cursor: "pointer" }}
                onMouseDown={e => e.preventDefault()}
                onClick={() => add(i.id)}>
                <b style={{ fontSize: 13 }}>{i.name}</b>
                {i.sku && <span className="mut mono" style={{ fontSize: 10.5 }}>{i.sku}</span>}
                <span style={{ marginLeft: "auto", fontSize: 11,
                  color: "var(--mut, #888)" }}>compare →</span>
              </button>))}
          </div>)}
        {open && fl && !options.length && (
          <div className="empty" style={{ padding: 12 }}>No items match “{q}”.</div>)}
      </div>

      {/* cards appear only for searched items */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))",
        gap: 12 }}>
        {cards.map(c => {
          const item = items.find(i => i.id === c.itemId);
          const list = c.list;
          const min = list.length ? Math.min(...list.map(p => p.rate)) : 0;
          const max = list.length ? Math.max(...list.map(p => p.rate)) : 0;
          const drift = list[0] && item?.cost && list[0].rate !== item.cost;
          return (
            <div key={c.itemId} style={{ border: "1px solid var(--line)",
              borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
                <b style={{ fontSize: 13 }}>{item?.name ?? c.itemId}</b>
                <button className="ib" title="Remove" onClick={() => remove(c.itemId)}>✕</button>
              </div>
              {!list.length && pending ? (
                <div className="empty" style={{ padding: 14 }}>Loading purchase history…</div>
              ) : (
                <>
                  {list.length > 1 && (
                    <div className="mut" style={{ fontSize: 11, margin: "2px 0 8px" }}>
                      range {inr(min)} – {inr(max)} · last {list.length} bills
                      {drift && <span className="chip amb" style={{ marginLeft: 6 }}
                        title="Item master cost differs from the latest bill">drift</span>}
                    </div>)}
                  <table className="t" style={{ fontSize: 11.5 }}>
                    <thead><tr><th>Bill</th><th>Date</th><th>Supplier</th>
                      <th className="num">Qty</th><th className="num">Rate</th></tr></thead>
                    <tbody>
                      {list.map((p, i) => (
                        <tr key={p.no}>
                          <td className="mono" style={{ fontSize: 10.5 }}>{p.no}</td>
                          <td style={{ fontSize: 10.5 }}>{p.date}</td>
                          <td style={{ fontSize: 10.5 }}>{p.supplier}</td>
                          <td className="num">{p.qty}</td>
                          <td className="num" style={{ fontWeight: i === 0 ? 700 : 400 }}>
                            {inr(p.rate)}{i === 0 &&
                              <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
                          </td>
                        </tr>))}
                      {!list.length && <tr><td colSpan={5}><div className="empty">
                        No purchases recorded for this item.</div></td></tr>}
                    </tbody>
                  </table>
                </>)}
            </div>);
        })}
        {!cards.length && <div className="empty">
          Nothing to compare yet — search an item above to load its purchase history.</div>}
      </div>
    </>
  );
}