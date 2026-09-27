"use client";
import { useState, useTransition } from "react";
import { saveBulkItemsAction, saveCatAction, saveSubAction, saveBrandAction } from "./actions";
import { showAlert } from "@/components/Alert";

type Cat = { id: string; name: string; emoji: string; parent_id: string | null };
type Brand = { id: string; name: string };
type Row = {
  name: string; sku: string; cost: string; pr: string; ps: string;
  mrp: string; stock: string; cat_id: string; sub_id: string; brand_id: string;
  has_serial: boolean;
};

export function BulkItemsForm({ cats, brands, onClose, onSaved }: {
  cats: Cat[]; brands: Brand[]; onClose: () => void; onSaved: () => void }) {
  const [count, setCount] = useState(10);
  // shared defaults — prefilled into rows, overridable per row
  const [defCat, setDefCat] = useState("");
  const [defSub, setDefSub] = useState("");
  const [defBrand, setDefBrand] = useState("");
  const [unit, setUnit] = useState("pc");
  const [gst, setGst] = useState(18);
  const [hsn, setHsn] = useState("");
  const [low, setLow] = useState("5");

  const mkRows = (n: number): Row[] => Array.from({ length: n }, () => ({
    name: "", sku: "", cost: "", pr: "", ps: "", mrp: "", stock: "0",
    cat_id: "", sub_id: "", brand_id: "", has_serial: false,
  }));
  const [rows, setRows] = useState<Row[]>(mkRows(10));
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const top = cats.filter(c => !c.parent_id);
  const subsOf = (cid: string) => cats.filter(c => c.parent_id === cid);

  // apply shared defaults to ALL empty-category rows (called when defaults change)
  const applyDefaults = (patch: { cat_id?: string; sub_id?: string; brand_id?: string }) => {
    setRows(rs => rs.map(r => ({
      ...r,
      cat_id: patch.cat_id !== undefined ? patch.cat_id : r.cat_id,
      sub_id: patch.sub_id !== undefined ? patch.sub_id : r.sub_id,
      brand_id: patch.brand_id !== undefined ? patch.brand_id : r.brand_id,
    })));
  };

  const generate = (n: number) => {
    const c = Math.min(50, Math.max(1, n || 10));
    setCount(c);
    setRows(prev => {
      const out = prev.slice(0, c);
      while (out.length < c) out.push({
        name: "", sku: "", cost: "", pr: "", ps: "", mrp: "", stock: "0",
        cat_id: defCat, sub_id: defSub, brand_id: defBrand, has_serial: false,
      });
      return out;
    });
  };

  const setR = (i: number, patch: Partial<Row>) =>
    setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const filled = rows.filter(r => r.name.trim()).length;

  const save = () => start(async () => {
    setErr("");
    const r = await saveBulkItemsAction({
      unit, gst, hsn, low: +low || 5,
      rows: rows.filter(r => r.name.trim()).map(r => ({
        name: r.name.trim(), sku: r.sku.trim(),
        cat_id: r.cat_id || null, sub_id: r.cat_id ? (r.sub_id || null) : null,
        brand_id: r.brand_id || null,
        cost: +r.cost || 0, pr: +r.pr || 0, ps: +r.ps || 0,
        mrp: +r.mrp || 0, stock: +r.stock || 0, has_serial: r.has_serial,
      })),
    });
    if (r.error) { setErr(r.error); return; }
    const needSerial = rows.filter(r => r.name.trim() && r.has_serial).map(r => r.name.trim());
    const sk = r.skipped?.length ? `\nSkipped (already exist): ${r.skipped.join(", ")}` : "";
    const sn = needSerial.length
      ? `\nSerial-tracked (capture serials on first purchase): ${needSerial.join(", ")}` : "";
    showAlert("Bulk add complete", `${r.created} item(s) created.${sk}${sn}`, "✅");
    onSaved();
  });

  const inp: React.CSSProperties = { width: "100%", minWidth: 0, padding: "6px 8px", fontSize: 12.5 };
  const num: React.CSSProperties = { ...inp, width: 82 };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 88, padding: 12 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 1180, maxWidth: "100%", maxHeight: "94vh",
        overflow: "auto", overscrollBehavior: "contain", padding: 18 }}>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>⚡ Quick add — multiple products</h3>
          <button className="btn sm" onClick={onClose}>✕ Close</button>
        </div>
        <p className="mut" style={{ fontSize: 12, margin: "6px 0 12px" }}>
          Defaults below prefill every row — each row can override Category / Sub / Brand.
          Name is the only required field. Duplicates are skipped (capitals don't matter).
          Photos &amp; per-item serials: add later via ✎ edit / first purchase.</p>

        {/* shared defaults — applied to all rows */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8,
          padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10,
          background: "var(--card2, #f2ecda)" }}>
          <div><label className="fl">Default category</label>
            <select className="inp" style={{ fontSize: 12.5 }} value={defCat}
              onChange={e => { setDefCat(e.target.value); setDefSub("");
                applyDefaults({ cat_id: e.target.value, sub_id: "" }); }}>
              <option value="">— none —</option>
              {top.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
            </select></div>
          <div><label className="fl">Default sub</label>
            <select className="inp" style={{ fontSize: 12.5 }} value={defSub} disabled={!defCat}
              onChange={e => { setDefSub(e.target.value); applyDefaults({ sub_id: e.target.value }); }}>
              <option value="">— none —</option>
              {subsOf(defCat).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select></div>
          <div><label className="fl">Default brand</label>
            <select className="inp" style={{ fontSize: 12.5 }} value={defBrand}
              onChange={e => { setDefBrand(e.target.value); applyDefaults({ brand_id: e.target.value }); }}>
              <option value="">— none —</option>
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div><label className="fl">Unit</label>
            <select className="inp" style={{ fontSize: 12.5 }} value={unit}
              onChange={e => setUnit(e.target.value)}>
              {["pc", "set", "box", "m", "kg"].map(u => <option key={u}>{u}</option>)}</select></div>
          <div><label className="fl">GST %</label>
            <select className="inp mono" style={{ fontSize: 12.5 }} value={gst}
              onChange={e => setGst(+e.target.value)}>
              {[0, 5, 12, 18, 28].map(s => <option key={s} value={s}>{s}%</option>)}</select></div>
          <div><label className="fl">HSN / Low alert</label>
            <div style={{ display: "flex", gap: 4 }}>
              <input className="inp mono" style={{ fontSize: 12.5 }} placeholder="HSN"
                value={hsn} onChange={e => setHsn(e.target.value)} />
              <input className="inp mono" style={{ fontSize: 12.5, width: 54 }} type="number"
                value={low} onChange={e => setLow(e.target.value)} title="Low-stock alert" />
            </div></div>
        </div>

        {/* row count */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0 8px" }}>
          <b style={{ fontSize: 13 }}>Rows:</b>
          <input className="inp mono" type="number" min="1" max="50" value={count}
            style={{ width: 72 }} onChange={e => generate(+e.target.value)} />
          {[10, 15, 20, 30].map(n => (
            <button key={n} type="button" className="fchip" onClick={() => generate(n)}>{n}</button>))}
          <span className="mut" style={{ fontSize: 12 }}>{filled} filled</span>
        </div>

        {/* rows — per-row category/sub/brand overrides + serial tick */}
        <div className="tblw">
          <table className="t">
            <thead><tr>
              <th style={{ width: 30 }}>#</th><th>Name *</th><th>SKU</th>
              <th style={{ minWidth: 120 }}>Category</th><th style={{ minWidth: 110 }}>Sub</th>
              <th style={{ minWidth: 110 }}>Brand</th>
              <th className="num">Cost</th><th className="num">Retail</th>
              <th className="num">Trade</th><th className="num">MRP</th>
              <th className="num">Stock</th><th style={{ width: 40 }}>S/N</th>
              <th style={{ width: 32 }} />
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="mut" style={{ fontSize: 11 }}>{i + 1}</td>
                  <td style={{ minWidth: 160 }}><input className="inp" style={inp}
                    value={r.name} onChange={e => setR(i, { name: e.target.value })} /></td>
                  <td><input className="inp mono" style={{ ...inp, width: 84 }}
                    value={r.sku} onChange={e => setR(i, { sku: e.target.value })} /></td>
                  <td><select className="inp" style={inp} value={r.cat_id}
                    onChange={e => setR(i, { cat_id: e.target.value, sub_id: "" })}>
                    <option value="">default</option>
                    {top.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                  </select></td>
                  <td><select className="inp" style={inp}
                    value={r.sub_id} disabled={!r.cat_id}
                    onChange={e => setR(i, { sub_id: e.target.value })}>
                    <option value="">default</option>
                    {subsOf(r.cat_id).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></td>
                  <td><select className="inp" style={inp} value={r.brand_id}
                    onChange={e => setR(i, { brand_id: e.target.value })}>
                    <option value="">default</option>
                    {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select></td>
                  <td><input className="inp mono" style={num} type="number" min="0" step="0.01"
                    value={r.cost} onChange={e => setR(i, { cost: e.target.value })} /></td>
                  <td><input className="inp mono" style={num} type="number" min="0" step="0.01"
                    value={r.pr} onChange={e => setR(i, { pr: e.target.value })} /></td>
                  <td><input className="inp mono" style={num} type="number" min="0" step="0.01"
                    value={r.ps} onChange={e => setR(i, { ps: e.target.value })} /></td>
                  <td><input className="inp mono" style={num} type="number" min="0" step="0.01"
                    value={r.mrp} onChange={e => setR(i, { mrp: e.target.value })} /></td>
                  <td><input className="inp mono" style={{ ...num, width: 62 }} type="number" min="0"
                    value={r.stock} onChange={e => setR(i, { stock: e.target.value })} /></td>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" style={{ width: 16, height: 16 }}
                      checked={r.has_serial} title="Serial-tracked"
                      onChange={e => setR(i, { has_serial: e.target.checked })} /></td>
                  <td><button type="button" className="ib" title="Clear row"
                    onClick={() => setR(i, {
                      name: "", sku: "", cost: "", pr: "", ps: "", mrp: "", stock: "0",
                      cat_id: "", sub_id: "", brand_id: "", has_serial: false })}>✕</button></td>
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