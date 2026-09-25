"use client";
import { useState } from "react";

/* Serial input for voucher lines.
   - No `inStock` prop → free-entry mode (PURCHASES): type or paste serials.
   - With `inStock`    → picker mode (SALES): tick serials from the in-stock list. */
export function SerialInput({ qty, value, onChange, inStock }: {
  qty: number; value: string[]; onChange: (v: string[]) => void; inStock?: string[];
}) {
  const [text, setText] = useState("");
  const [filter, setFilter] = useState("");
  const list = value;

  /* ---------- PICKER MODE (sale) ---------- */
  if (inStock) {
    const fl = filter.trim().toLowerCase();
    const shown = fl ? inStock.filter(s => s.toLowerCase().includes(fl)) : inStock;
    const toggle = (s: string) =>
      onChange(list.includes(s) ? list.filter(x => x !== s) : [...list, s]);
    const ok = list.length === qty;
    return (
      <div style={{ marginTop: 4, border: "1px dashed var(--line)", borderRadius: 8, padding: 8 }}>
        <div style={{ fontSize: 11, marginBottom: 6 }}>
          <b className={ok ? "pos" : "neg"}>{list.length}/{qty}</b>
          <span className="mut"> serial(s) selected for this line</span>
        </div>
        {inStock.length > 8 && (
          <input className="inp mono" style={{ fontSize: 12, marginBottom: 6 }}
            placeholder="Filter serials…" value={filter}
            onChange={e => setFilter(e.target.value)} />
        )}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 130, overflow: "auto" }}>
          {shown.map(s => {
            const on = list.includes(s);
            return (
              <button key={s} type="button" className={"chip" + (on ? " grn" : "")}
                style={{ fontSize: 11, cursor: "pointer" }}
                onClick={() => toggle(s)}>
                {on ? "✓ " : ""}{s}
              </button>);
          })}
          {!shown.length && <span className="mut" style={{ fontSize: 11.5 }}>
            No in-stock serials{fl ? " match" : ""} — capture serials at purchase, or add via /erp/serials.</span>}
        </div>
      </div>
    );
  }

  /* ---------- FREE-ENTRY MODE (purchase) ---------- */
  const remaining = Math.max(0, qty - list.length);
  const addFromText = () => {
    const parts = text.split(/[\n,;\t]+/).map(x => x.trim()).filter(Boolean);
    if (!parts.length) return;
    onChange([...list, ...parts]);
    setText("");
  };
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {list.map((s, i) => (
          <span key={i} className="chip mono" style={{ fontSize: 11 }}>
            {s}
            <button className="ib" style={{ marginLeft: 4 }} type="button"
              onClick={() => onChange(list.filter((_, j) => j !== i))}>✕</button>
          </span>))}
        {list.length === 0 && <span className="mut" style={{ fontSize: 11.5 }}>
          No serials entered yet</span>}
      </div>
      {remaining > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <input className="inp mono" style={{ fontSize: 12 }} value={text}
            placeholder={`Serial(s) — ${remaining} more (paste comma / newline separated)`}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addFromText(); } }} />
          <button className="btn sm" type="button" onClick={addFromText}>＋ Add</button>
        </div>)}
    </div>
  );
}