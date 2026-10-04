"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = { id: string; name: string; sku: string; cost: number };

/* Hero item picker: big, full-width, keyboard-first.
   Shows the selected item's NAME (never the uuid). */
export function ItemHistoryPicker({ items, itemId, nLimit, view }: {
  items: Item[]; itemId: string; nLimit: number; view: string;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const selected = items.find(i => i.id === itemId) ?? null;
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
    <div ref={wrap} style={{ position: "relative", width: "100%" }}>
      <input
        style={{ width: "100%", fontSize: 18, fontWeight: 600,
          padding: "16px 16px 16px 46px", borderRadius: 12 }}
        required
        value={q !== "" ? q : (selected?.name ?? "")}
        placeholder="🔍  Search item name / SKU…"
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); setHi(0); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey} autoComplete="off" />
      {open && q.trim() !== "" && options.length > 0 && (
        <div style={{ position: "absolute", zIndex: 70, left: 0, right: 0,
          top: "calc(100% + 4px)", background: "var(--card, #fff)",
          border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 12px 34px rgba(0,0,0,.16)", maxHeight: 300, overflowY: "auto",
          overscrollBehavior: "contain" }}>
          {options.map((i, idx) => (
            <div key={i.id} data-idx={idx}
              style={{ display: "flex", gap: 10, alignItems: "center", padding: "11px 14px",
                borderBottom: "1px solid var(--line)", cursor: "pointer",
                background: idx === hi ? "var(--card2, #f2ecda)" : "transparent" }}
              onMouseEnter={() => setHi(idx)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => go(i.id)}>
              <b style={{ fontSize: 14.5, whiteSpace: "nowrap" }}>{i.name}</b>
              {i.sku && <span className="mut mono" style={{ fontSize: 11.5 }}>{i.sku}</span>}
              <span className="mut" style={{ marginLeft: "auto", fontSize: 12, whiteSpace: "nowrap" }}>
                cost ₹{Math.round(i.cost || 0)}</span>
            </div>))}
        </div>)}
    </div>
  );
}