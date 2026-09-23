"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type LSItem = { id: string };

export function LiveSearch<T extends LSItem>({
  items, getLabel, getSub, onPick, placeholder = "Type to search…",
  selectedId, allowAdd, onAdd, width, pageSize,
}: {
  items: T[];
  getLabel: (i: T) => string;
  getSub?: (i: T) => string;
  onPick: (i: T | null) => void;
  placeholder?: string;
  selectedId?: string;
  allowAdd?: boolean;
  onAdd?: (name: string) => Promise<T | null>;
  width?: number | string;
  pageSize?: number;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [adding, setAdding] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const sel = items.find(i => i.id === selectedId) ?? null;

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const f = !s ? items
      : items.filter(i => getLabel(i).toLowerCase().includes(s) || (getSub?.(i) ?? "").toLowerCase().includes(s));
    return f.slice(0, pageSize ?? 15);
  }, [items, q, getLabel, getSub, pageSize]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (i: T) => { onPick(i); setQ(""); setOpen(false); };

  return (
    <div ref={box} style={{ position: "relative", width: width ?? "100%" }}>
      <input className="inp ls-input" value={open ? q : (sel ? getLabel(sel) : "")}
        placeholder={placeholder}
        onFocus={() => { setOpen(true); setQ(""); setHi(0); }}
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={e => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi(h => Math.min(h + 1, list.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi(h => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (list[hi]) pick(list[hi]);
          }
          else if (e.key === "Escape") setOpen(false);
        }} />
      {sel && !open && (
        <button type="button" className="ib" title="Clear"
          style={{ position: "absolute", right: 4, top: 5 }}
          onClick={() => onPick(null)}>✕</button>)}
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 95,
          background: "var(--card)", border: "1px solid var(--line2)", borderRadius: 10,
          maxHeight: 280, overflowY: "auto", boxShadow: "var(--sh)", marginTop: 4 }}>
          {list.map((i, ix) => (
            <div key={i.id} onMouseDown={e => { e.preventDefault(); pick(i); }}
              style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13.5,
                background: ix === hi ? "var(--brand2)" : "transparent",
                display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 600 }}>{getLabel(i)}</span>
              {getSub && <span className="mut" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>{getSub(i)}</span>}
            </div>))}
          {allowAdd && onAdd && q.trim() &&
            !list.some(i => getLabel(i).toLowerCase() === q.trim().toLowerCase()) && (
            <div onMouseDown={async e => {
              e.preventDefault();
              if (adding) return;
              setAdding(true);
              try {
                const created = await onAdd(q.trim());
                if (created) pick(created); else setQ("");
              } finally { setAdding(false); }
            }} style={{ padding: "9px 12px", cursor: "pointer", fontSize: 13, color: "var(--brand)",
              fontWeight: 700, borderTop: "1px solid var(--line)" }}>
              {adding ? "Adding…" : <>＋ Add “{q.trim()}”</>}
            </div>)}
          {!list.length && !allowAdd &&
            <div className="mut" style={{ padding: "10px 12px", fontSize: 13 }}>No match</div>}
        </div>)}
    </div>
  );
}