"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { read as readCart, write as writeCart } from "./cartStore";
import { showAlert } from "@/components/Alert";

export type StoreItem = { id: string; name: string; sku: string; unit: string;
  cat_id: string; sub_id: string | null; brand_id: string | null;
  pr: number; ps: number; mrp: number; stock: number; low: number; image_url: string };
export type StoreCat = { id: string; name: string; emoji: string; parent_id: string | null };
export type Brand = { id: string; name: string };

const fmtInr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function StoreBrowser({ items, cats, brands, trade, tenantId }: {
  items: StoreItem[]; cats: StoreCat[]; brands: Brand[]; trade: boolean; tenantId: string }) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sub, setSub] = useState("all");
  const [brand, setBrand] = useState("all");
  const [sel, setSel] = useState<StoreItem | null>(null);
  const [qty, setQty] = useState(1);
  const top = cats.filter(c => !c.parent_id);
  const subs = cats.filter(c => c.parent_id === cat);
  const price = (i: StoreItem) => (trade ? i.ps : i.pr);

  const list = useMemo(() => items.filter(i =>
    (cat === "all" || i.cat_id === cat) && (sub === "all" || i.sub_id === sub) &&
    (brand === "all" || i.brand_id === brand) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()) || i.sku.toLowerCase().includes(q.toLowerCase()))
  ), [items, q, cat, sub, brand]);

  const add = (it: StoreItem, n: number) => {
    const entries = readCart(tenantId);
    const ex = entries.find(c => c.id === it.id);
    const next = Math.min((ex?.qty ?? 0) + n, it.stock || 99);
    if (ex) ex.qty = next; else entries.push({ id: it.id, qty: next });
    writeCart(tenantId, entries);
    setSel(null);
    showAlert("Added to cart", it.name, "🛒");
  };

  return (
    <>
      <div className="tool">
        <input className="inp" style={{ maxWidth: 250 }} placeholder="Search products, SKU…"
          value={q} onChange={e => setQ(e.target.value)} />
        <select className="inp" style={{ width: 180 }} value={cat}
          onChange={e => { setCat(e.target.value); setSub("all"); }}>
          <option value="all">All categories</option>
          {top.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        {subs.length > 0 && (
          <select className="inp" style={{ width: 160 }} value={sub} onChange={e => setSub(e.target.value)}>
            <option value="all">All types</option>
            {subs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>)}
        <select className="inp" style={{ width: 150 }} value={brand} onChange={e => setBrand(e.target.value)}>
          <option value="all">All brands</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="pgrid">
        {list.map(it => (
          <div className="pcard" key={it.id} onClick={() => { setSel(it); setQty(1); }}>
            <div className="ph-img">
              {it.image_url
                ? <Image src={it.image_url} alt={it.name} width={400} height={300} unoptimized
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : it.sku.slice(0, 2).toUpperCase()}
            </div>
            <div className="nm">{it.name}</div>
            <div className="pr">{fmtInr(price(it))}<s>MRP {fmtInr(it.mrp)}</s></div>
            <div className="mt">
              <span className="mono">{brands.find(b => b.id === it.brand_id)?.name
                ? brands.find(b => b.id === it.brand_id)!.name + " · " : ""}{it.sku}</span>
              <span className={it.stock <= 0 ? "neg" : it.stock <= it.low ? "" : "pos"}>
                {it.stock <= 0 ? "Out of stock" : it.stock <= it.low ? `${it.stock} left` : "In stock"}</span>
            </div>
          </div>))}
        {list.length === 0 && <div className="empty">Nothing matches — try another search.</div>}
      </div>

      {sel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSel(null); }}>
          <div className="panel" style={{ width: 540, maxWidth: "100%", padding: 20 }}>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ width: 140, height: 140, borderRadius: 14, overflow: "hidden",
                background: "#f1ecdf", display: "grid", placeItems: "center", flex: "none" }}>
                {sel.image_url
                  ? <Image src={sel.image_url} alt={sel.name} width={280} height={280} unoptimized
                      style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : sel.sku.slice(0, 2).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 210 }}>
                <div style={{ font: "700 24px var(--font-disp)" }}>
                  {fmtInr(price(sel))} <s style={{ font: "400 13px var(--font-ui)", color: "var(--faint)" }}>MRP {fmtInr(sel.mrp)}</s></div>
                {!trade && <div className="mut" style={{ fontSize: 12, marginTop: 4 }}>
                  Trade price: <b>{fmtInr(sel.ps)}</b> — shopkeeper login</div>}
                <table className="t" style={{ marginTop: 10 }}><tbody>
                  <tr><td>SKU</td><td className="mono">{sel.sku}</td></tr>
                  <tr><td>Stock</td><td>{sel.stock > 0 ? `${sel.stock} ${sel.unit} available` : "Out of stock"}</td></tr>
                </tbody></table>
                <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                  <input className="inp mono" type="number" min={1} value={qty}
                    onChange={e => setQty(Math.max(1, +e.target.value || 1))} style={{ width: 76 }} />
                  <button className="btn pri" disabled={sel.stock <= 0} onClick={() => add(sel, qty)}>Add to cart</button>
                  <button className="btn" onClick={() => setSel(null)}>Back</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}