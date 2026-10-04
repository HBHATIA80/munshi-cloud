"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; name: string; sku: string; cost: number };

/* Live item picker for the Item History page.
   Type → suggestions (name + SKU + master cost) → click or Enter/Tab selects →
   navigates to ?item=<id>&n=<n>. Displays the NAME, submits the ID. */
export function ItemHistoryPicker({ items, itemId, nLimit, view }: {
  items: Item[]; itemId: string; nLimit: number; view: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const selected = items.find(i => i.id === itemId);
  const fl = q.trim().toLowerCase();
  const options = useMemo(() => (fl
    ? items.filter(i => i.name.toLowerCase().includes(fl) ||
        (i.sku ?? "").toLowerCase().includes(fl))
    : items).slice(0, 10), [items, fl]);

  useEffect(() => { setHi(0); }, [q]);
  useEffect(() => {
    wrap.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [hi, open, q]);

  const go = (id: string) => {
    setOpen(false); setQ("");
    router.push(`/erp/item-history?item=${encodeURIComponent(id)}&n=${nLimit}&view=${view}`);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi(h => (h + 1) % Math.max(1, options.length)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => (h - 1 + Math.max(1, options.length)) % Math.max(1, options.length)); }
    else if (e.key === "Enter") { e.preventDefault(); if (options[hi]) go(options[hi].id); }
    else if (e.key === "Tab") { if (open && options[hi]) { e.preventDefault(); go(options[hi].id); } }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrap} style={{ position: "relative", maxWidth: 360 }}>
      <input className="inp" required
        style={{ width: "100%" }}
        placeholder={selected ? selected.name : "Type to search item name / SKU…"}
        value={q !== "" ? q : (selected ? selected.name : "")}
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); setHi(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey} autoComplete="off" />
      {open && q.trim() && options.length > 0 && (
        <div style={{ position: "absolute", zIndex: 70, left: 0, right: 0,
          top: "calc(100% + 4px)", background: "var(--card, #fff)",
          border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,.14)", maxHeight: 264, overflowY: "auto",
          overscrollBehavior: "contain" }}>
          {options.map((i, idx) => (
            <div key={i.id} data-idx={idx}
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 12px",
                borderBottom: "1px solid var(--line)", cursor: "pointer",
                background: idx === hi ? "var(--card2, #f2ecda)" : "transparent" }}
              onMouseEnter={() => setHi(idx)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => go(i.id)}>
              <b style={{ fontSize: 13, whiteSpace: "nowrap" }}>{i.name}</b>
              {i.sku && <span className="mut mono" style={{ fontSize: 11 }}>{i.sku}</span>}
              <span className="mut" style={{ marginLeft: "auto", fontSize: 11, whiteSpace: "nowrap" }}>
                cost ₹{Math.round(i.cost || 0)}</span>
            </div>))}
        </div>)}
    </div>
  );
}