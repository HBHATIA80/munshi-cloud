"use client";
import { useState, useTransition } from "react";
import { saveBulkItemsAction, saveCatAction, saveSubAction, saveBrandAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";
import { showAlert } from "@/components/Alert";

type Cat = { id: string; name: string; emoji: string; parent_id: string | null };
type Brand = { id: string; name: string };
type Row = { name: string; sku: string; cost: string; pr: string; ps: string; mrp: string; stock: string };

const blank: Row = { name: "", sku: "", cost: "", pr: "", ps: "", mrp: "", stock: "0" };

export function BulkItemsForm({ cats, brands, onClose, onSaved }: {
  cats: Cat[]; brands: Brand[]; onClose: () => void; onSaved: () => void }) {
  const [count, setCount] = useState(10);
  const [rows, setRows] = useState<Row[]>(Array.from({ length: 10 }, () => ({ ...blank })));
  const [catId, setCatId] = useState<string | null>(null);
  const [subId, setSubId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [unit, setUnit] = useState("pc");
  const [gst, setGst] = useState(18);
  const [hsn, setHsn] = useState("");
  const [low, setLow] = useState("5");
  const [hasSerial, setHasSerial] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const top = cats.filter(c => !c.parent_id);
  const subs = cats.filter(c => c.parent_id === catId);

  const generate = (n: number) => {
    const c = Math.min(50, Math.max(1, n || 10));
    setCount(c);
    setRows(prev => {
      const out = prev.slice(0, c);                       // keep typed rows
      while (out.length < c) out.push({ ...blank });
      return out;
    });
  };

  const setR = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const filled = rows.filter(r => r.name.trim()).length;

  const save = () => start(async () => {
    setErr("");
    const r = await saveBulkItemsAction({
      cat_id: catId, sub_id: subId, brand_id: brandId,
      unit, gst, hsn, low: +low || 5, has_serial: hasSerial,
      rows: rows
        .filter(r => r.name.trim())
        .map(r => ({ name: r.name.trim(), sku: r.sku.trim(),
          cost: +r.cost || 0, pr: +r.pr || 0, ps: +r.ps || 0,
          mrp: +r.mrp || 0, stock: +r.stock || 0 })),
    });
    if (r.error) { setErr(r.error); return; }
    const sk = r.skipped?.length
      ? ` Skipped (already exist): ${r.skipped.join(", ")}` : "";
    showAlert("Bulk add complete", `${r.created} item(s) created.${sk}`, "✅");
    onSaved();
  });

  const cell = "inp mono";
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 88, padding: 14 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 980, maxWidth: "100%", maxHeight: "94vh",
        overflow: "auto", padding: 20 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>⚡ Quick add — multiple products</h3>
          <button className="btn sm" onClick={onClose}>✕ Close</button>
        </div>
        <p className="mut" style={{ fontSize: 12, margin: "6px 0 12px" }}>
          Set the shared details once, then fill the rows — Name is the only required field per row.
          Duplicate names are skipped automatically (capitals don't matter).</p>

        {/* shared defaults */}
        <div className="frm" style={{ gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          <div><label className="fl">Category</label>
            <LiveSearch items={top} getLabel={c => (c.emoji ?? "") + " " + c.name} allowAdd
              onAdd={async name => {
                const r = await saveCatAction(name, "");
                if (r.error) { setErr(r.error); return null; }
                return { id: r.id!, name, emoji: "📦", parent_id: null };
              }}
              onPick={c => { setCatId(c?.id ?? null); setSubId(null); }}
              placeholder="Category…" /></div>
          <div><label className="fl">Sub-category</label>
            <LiveSearch items={subs} getLabel={s => s.name} allowAdd
              onAdd={async name => {
                if (!catId) { setErr("Pick a category first."); return null; }
                const r = await saveSubAction(name, catId);
                if (r.error) { setErr(r.error); return null; }
                return { id: r.id!, name, emoji: "📦", parent_id: catId };
              }}
              onPick={s => setSubId(s?.id ?? null)}
              placeholder={catId ? "Sub-category…" : "Pick a category first"} /></div>
          <div><label className="fl">Brand</label>
            <LiveSearch items={brands} getLabel={b => b.name} allowAdd
              onAdd={async name => {
                const r = await saveBrandAction(name);
                if (r.error) { setErr(r.error); return null; }
                return { id: r.id!, name };
              }}
              onPick={b => setBrandId(b?.id ?? null)}
              placeholder="Brand…" /></div>
          <div><label className="fl">Unit</label>
            <select className="inp" value={unit} onChange={e => setUnit(e.target.value)}>
              {["pc", "set", "box", "m", "kg"].map(u => <option key={u}>{u}</option>)}</select></div>
          <div><label className="fl">GST %</label>
            <select className="inp mono" value={gst} onChange={e => setGst(+e.target.value)}>
              {[0, 5, 12, 18, 28].map(s => <option key={s} value={s}>{s}%</option>)}</select></div>
          <div><label className="fl">HSN (shared)</label>
            <input className="inp mono" value={hsn} onChange={e => setHsn(e.target.value)} /></div>
          <div><label className="fl">Low-stock alert</label>
            <input className="inp mono" type="number" value={low}
              onChange={e => setLow(e.target.value)} /></div>
          <div style={{ display: "flex", alignItems: "end", gap: 8, paddingBottom: 4 }}>
            <input type="checkbox" id="bulkSerial" checked={hasSerial}
              onChange={e => setHasSerial(e.target.checked)} style={{ width: 17, height: 17 }} />
            <label htmlFor="bulkSerial" style={{ fontSize: 12.5, cursor: "pointer" }}>
              Serial-tracked</label>
          </div>
        </div>

        {/* row count generator */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "14px 0 8px" }}>
          <b style={{ fontSize: 13 }}>Rows:</b>
          <input className="inp mono" type="number" min="1" max="50" value={count}
            style={{ width: 76 }}
            onChange={e => generate(+e.target.value)} />
          {[10, 15, 20].map(n => (
            <button key={n} type="button" className="fchip" onClick={() => generate(n)}>{n}</button>))}
          <span className="mut" style={{ fontSize: 12 }}>{filled} filled</span>
        </div>

        {/* rows grid */}
        <div className="tblw">
          <table className="t">
            <thead><tr>
              <th style={{ width: 34 }}>#</th><th>Name *</th><th>SKU</th>
              <th className="num">Cost</th><th className="num">Retail</th>
              <th className="num">Trade</th><th className="num">MRP</th>
              <th className="num">Stock</th><th style={{ width: 34 }} />
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="mut" style={{ fontSize: 11 }}>{i + 1}</td>
                  <td><input className="inp" value={r.name} style={{ width: "100%" }}
                    onChange={e => setR(i, { name: e.target.value })} /></td>
                  <td><input className={cell} value={r.sku} style={{ width: 90 }}
                    onChange={e => setR(i, { sku: e.target.value })} /></td>
                  <td><input className={cell} type="number" min="0" step="0.01" style={{ width: 84 }}
                    value={r.cost} onChange={e => setR(i, { cost: e.target.value })} /></td>
                  <td><input className={cell} type="number" min="0" step="0.01" style={{ width: 84 }}
                    value={r.pr} onChange={e => setR(i, { pr: e.target.value })} /></td>
                  <td><input className={cell} type="number" min="0" step="0.01" style={{ width: 84 }}
                    value={r.ps} onChange={e => setR(i, { ps: e.target.value })} /></td>
                  <td><input className={cell} type="number" min="0" step="0.01" style={{ width: 84 }}
                    value={r.mrp} onChange={e => setR(i, { mrp: e.target.value })} /></td>
                  <td><input className={cell} type="number" min="0" style={{ width: 64 }}
                    value={r.stock} onChange={e => setR(i, { stock: e.target.value })} /></td>
                  <td><button type="button" className="ib" title="Clear row"
                    onClick={() => setR(i, { ...blank })}>✕</button></td>
                </tr>))}
            </tbody>
          </table>
        </div>

        {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 14 }}>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" disabled={pending || !filled} onClick={save}>
            {pending ? "Saving…" : `Save ${filled} item${filled === 1 ? "" : "s"}`}</button>
        </div>
      </div>
    </div>
  );
}