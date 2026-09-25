"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveItemAction, deleteItemAction, saveCatAction, saveSubAction, saveBrandAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";
import { showAlert, showConfirm } from "@/components/Alert";

type Cat = { id: string; name: string; emoji: string; parent_id: string | null };
type Brand = { id: string; name: string };
type Item = { id: string; name: string; sku: string; unit: string; cat_id: string | null;
  sub_id: string | null; brand_id: string | null; hsn: string; gst: number; cost: number;
  pr: number; ps: number; mrp: number; stock: number; low: number; image_url: string;
  has_serial: boolean };

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
const inclOf = (v: string, gst: number) => {
  const n = +v || 0;
  return n > 0 ? "₹" + Math.round(n * (1 + gst / 100)).toLocaleString("en-IN") + " incl. GST" : "";
};

function downloadCsv(name: string, rows: (string | number)[][]) {
  const q = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(q).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

async function compress(file: File): Promise<string> {
  const img = new window.Image();
  img.src = URL.createObjectURL(file);
  await new Promise(r => { img.onload = r; });
  const cv = document.createElement("canvas");
  const max = 800;
  let w = img.width, h = img.height;
  if (w > max) { h = h * max / w; w = max; }
  cv.width = w; cv.height = h;
  cv.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return cv.toDataURL("image/jpeg", 0.82);
}

export function ItemsView({ items, cats, brands }: { items: Item[]; cats: Cat[]; brands: Brand[] }) {
  const [q, setQ] = useState("");
  const [catId, setCatId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [size, setSize] = useState(15);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const router = useRouter();

  const list = items.filter(i =>
    (!catId || i.cat_id === catId) && (!brandId || i.brand_id === brandId) &&
    (!q || i.name.toLowerCase().includes(q.toLowerCase()) ||
      (i.sku || "").toLowerCase().includes(q.toLowerCase()) ||
      (i.hsn || "").toLowerCase().includes(q.toLowerCase())));

  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(page, pages);
  const view = list.slice((cur - 1) * size, cur * size);

  return (
    <>
      <div className="tool">
        <input className="inp" style={{ maxWidth: 260 }} placeholder="Search name / SKU / HSN…"
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <div style={{ width: 200 }}><LiveSearch items={cats.filter(c => !c.parent_id)}
          getLabel={c => c.name} placeholder="All categories — search…"
          selectedId={catId ?? undefined} onPick={c => { setCatId(c?.id ?? null); setPage(1); }} /></div>
        <div style={{ width: 190 }}><LiveSearch items={brands}
          getLabel={b => b.name} placeholder="All brands — search…"
          selectedId={brandId ?? undefined} onPick={b => { setBrandId(b?.id ?? null); setPage(1); }} /></div>
        <select className="inp" style={{ width: 105 }} value={size}
          onChange={e => { setSize(+e.target.value); setPage(1); }}>
          {[15, 30, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => downloadCsv("items.csv", [
          ["Name", "SKU", "Unit", "Category", "Brand", "HSN", "GST%", "Cost", "Retail", "Trade",
            "MRP", "Stock", "Low alert", "Serial-tracked"],
          ...list.map(i => [i.name, i.sku, i.unit,
            cats.find(c => c.id === i.cat_id)?.name ?? "", brands.find(b => b.id === i.brand_id)?.name ?? "",
            i.hsn, i.gst, i.cost, i.pr, i.ps, i.mrp, i.stock, i.low, i.has_serial ? "yes" : ""]),
        ])}>⭳ CSV</button>
        <button className="btn pri" onClick={() => setEdit("new")}>＋ Add product</button>
      </div>
      <div className="panel"><div className="tblw"><table className="t">
        <thead><tr><th>Product</th><th>Category</th><th>Brand</th><th className="num">GST</th>
          <th className="num">Cost (excl)</th><th className="num">Retail (excl)</th>
          <th className="num">Trade (excl)</th><th className="num">Stock</th><th>Serials</th><th /></tr></thead>
        <tbody>
          {view.map(i => {
            const c = cats.find(x => x.id === i.cat_id);
            const b = brands.find(x => x.id === i.brand_id);
            return (
              <tr key={i.id}>
                <td>{i.image_url
                  ? <Image src={i.image_url} alt="" width={38} height={38} unoptimized
                      style={{ width: 38, height: 38, objectFit: "cover", borderRadius: 8, verticalAlign: "middle", marginRight: 8 }} />
                  : null}<b>{i.name}</b> <span className="mut mono" style={{ fontSize: 11 }}>{i.sku}</span></td>
                <td className="mut">{c ? c.name : "—"}</td>
                <td>{b ? <span className="chip">{b.name}</span> : <span className="mut">—</span>}</td>
                <td className="num">{i.gst}%</td>
                <td className="num">{inr(i.cost)}</td>
                <td className="num">{inr(i.pr)}</td>
                <td className="num"><b>{inr(i.ps)}</b></td>
                <td className="num" style={{ fontWeight: 700,
                    color: i.stock <= 0 ? "var(--red)" : i.stock <= i.low ? "var(--amber)" : "inherit" }}>
                  {i.stock}</td>
                <td>{i.has_serial ? <span className="chip blu" title="Serial-tracked">S/N</span> : <span className="mut">—</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="ib" title="Edit" onClick={() => setEdit(i)}>✎</button>
                  <button className="ib" title="Delete" onClick={async () => {
                    if (await showConfirm("Delete item", `Delete "${i.name}"?`)) {
                      try { await deleteItemAction(i.id); router.refresh(); }
                      catch (e: any) { showAlert("Delete failed", e.message, "❌"); }
                    }
                  }}>🗑</button>
                </td>
              </tr>);
          })}
          {!list.length && <tr><td colSpan={10}><div className="empty">No products match — add your first one.</div></td></tr>}
        </tbody>
      </table></div></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10 }}>
        <span className="mut" style={{ fontSize: 12 }}>
          {list.length
            ? `Showing ${(cur - 1) * size + 1}–${Math.min(cur * size, list.length)} of ${list.length}`
            : "Nothing to show"}
        </span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button className="btn sm" disabled={cur <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
          <span className="mut" style={{ fontSize: 12 }}>Page {cur} / {pages}</span>
          <button className="btn sm" disabled={cur >= pages}
            onClick={() => setPage(p => Math.min(pages, p + 1))}>Next →</button>
        </div>
      </div>

      {edit && <ItemForm item={edit === "new" ? null : edit} cats={cats} brands={brands}
        allItems={items}
        onClose={() => { setEdit(null); router.refresh(); }} />}
    </>
  );
}

function ItemForm({ item, cats, brands, allItems, onClose }: {
  item: Item | null; cats: Cat[]; brands: Brand[]; allItems: Item[]; onClose: () => void }) {
  const router = useRouter();
  const [img, setImg] = useState<string>(item?.image_url || "");
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [catId, setCatId] = useState<string | null>(item?.cat_id ?? null);
  const [subId, setSubId] = useState<string | null>(item?.sub_id ?? null);
  const [brandId, setBrandId] = useState<string | null>(item?.brand_id ?? null);
  const [catList, setCatList] = useState<Cat[]>(cats);
  const [brandList, setBrandList] = useState<Brand[]>(brands);
  const top = catList.filter(c => !c.parent_id);
  const subs = catList.filter(c => c.parent_id === catId);

  const [name, setName] = useState(item?.name ?? "");
  const [cost, setCost] = useState(String(item?.cost ?? ""));
  const [pr, setPr] = useState(String(item?.pr ?? ""));
  const [ps, setPs] = useState(String(item?.ps ?? ""));
  const [gst, setGst] = useState<number>(item?.gst ?? 0);
  const [hasSerial, setHasSerial] = useState<boolean>(item?.has_serial ?? false);

  /* hard duplicate check: case-insensitive, server-enforced (also by unique index) */
  const dupe = !item && allItems.find(i =>
    i.name.trim().toLowerCase() === name.trim().toLowerCase() &&
    (i.cat_id ?? null) === (catId ?? null));

  const submit = (fd: FormData) => {
    if (item) fd.set("id", item.id);
    if (img.startsWith("data:image")) fd.set("image", img);
    fd.set("cat_id", catId ?? "");
    fd.set("sub_id", subId ?? "");
    fd.set("brand_id", brandId ?? "");
    fd.set("has_serial", hasSerial ? "1" : "0");
    start(async () => {
      try { await saveItemAction(fd); onClose(); }
      catch (e: any) {
        showAlert("Save failed",
          e?.code === "23505" || /duplicate|unique/i.test(e?.message ?? "")
            ? "That name already exists (names are unique regardless of capitals)."
            : e.message, "❌");
      }
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 640, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", padding: 20 }}>
        <h3 style={{ marginBottom: 4 }}>{item ? "Edit product" : "Add product"}</h3>
        <p className="mut" style={{ fontSize: 12, marginBottom: 12 }}>
          All prices below are <b>excl. GST</b> — GST is added automatically on GST invoices.</p>
        <form action={submit}>
          <label className="fl">Product photo</label>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 74, height: 74, borderRadius: 12, background: "#f1ecdf",
              border: "1px dashed var(--line2)", overflow: "hidden", display: "grid", placeItems: "center", flex: "none" }}>
              {img ? <Image src={img} alt="" width={74} height={74} unoptimized style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : "📦"}
            </div>
            <input type="file" accept="image/*" style={{ fontSize: 13 }}
              onChange={async e => { const f = e.target.files?.[0]; if (f) setImg(await compress(f)); }} />
          </div>
          <div className="frm" style={{ marginTop: 14 }}>
            <div className="full"><label className="fl">Name *</label>
              <input className="inp" name="name" value={name}
                onChange={e => setName(e.target.value)} required />
              {dupe && (
                <p className="neg" style={{ fontSize: 11.5, marginTop: 4 }}>
                  ⚠ “{dupe.name}” already exists — names are unique regardless of capitals.
                  Edit the existing item instead.</p>)}
            </div>
            <div><label className="fl">SKU</label><input className="inp mono" name="sku" defaultValue={item?.sku ?? ""} /></div>
            <div><label className="fl">Unit</label><select className="inp" name="unit" defaultValue={item?.unit ?? "pc"}>
              {["pc", "set", "box", "m", "kg"].map(u => <option key={u}>{u}</option>)}</select></div>
            <div><label className="fl">Category</label>
              <LiveSearch items={top} getLabel={c => (c.emoji ?? "") + " " + c.name} allowAdd
                onAdd={async name => {
                  const r = await saveCatAction(name, "");
                  if (r.error) { setErr(r.error); return null; }
                  const c = { id: r.id!, name, emoji: "📦", parent_id: null };
                  setCatList(l => [...l, c]); setCatId(c.id); setSubId(null);
                  return c;
                }}
                placeholder="Search or add category…" selectedId={catId ?? undefined}
                onPick={c => { setCatId(c?.id ?? null); setSubId(null); }} /></div>
            <div><label className="fl">Sub-category</label>
              <LiveSearch items={subs} getLabel={s => s.name} allowAdd
                onAdd={async name => {
                  if (!catId) { setErr("Pick a category first, then add a sub-category."); return null; }
                  const r = await saveSubAction(name, catId);
                  if (r.error) { setErr(r.error); return null; }
                  const sc = { id: r.id!, name, emoji: "📦", parent_id: catId };
                  setCatList(l => [...l, sc]); setSubId(sc.id);
                  return sc;
                }}
                placeholder={catId ? "Search or add sub-category…" : "Pick a category first"}
                selectedId={subId ?? undefined} onPick={s => setSubId(s?.id ?? null)} /></div>
            <div><label className="fl">Brand</label>
              <LiveSearch items={brandList} getLabel={b => b.name} allowAdd
                onAdd={async name => {
                  const r = await saveBrandAction(name);
                  if (r.error) { setErr(r.error); return null; }
                  const b = { id: r.id!, name };
                  setBrandList(l => [...l, b]); setBrandId(b.id);
                  return b;
                }}
                placeholder="Search or add brand…" selectedId={brandId ?? undefined}
                onPick={b => setBrandId(b?.id ?? null)} /></div>
            <div><label className="fl">HSN</label><input className="inp mono" name="hsn" defaultValue={item?.hsn ?? ""} /></div>
            <div><label className="fl">GST rate</label>
              <select className="inp mono" name="gst" value={gst}
                onChange={e => setGst(+e.target.value)}>
                {[0, 5, 12, 18, 28].map(s => <option key={s} value={s}>{s}%</option>)}</select></div>
            <div><label className="fl">Purchase cost * (excl. GST)</label>
              <input className="inp mono" name="cost" type="number" min="0" step="0.01"
                value={cost} onChange={e => setCost(e.target.value)} required />
              <div className="mut" style={{ fontSize: 10.5, marginTop: 3 }}>{inclOf(cost, gst)}</div></div>
            <div><label className="fl">Retailer price * (excl. GST)</label>
              <input className="inp mono" name="pr" type="number" min="0" step="0.01"
                value={pr} onChange={e => setPr(e.target.value)} required />
              <div className="mut" style={{ fontSize: 10.5, marginTop: 3 }}>{inclOf(pr, gst)}</div></div>
            <div><label className="fl">Shopkeeper (trade) price * (excl. GST)</label>
              <input className="inp mono" name="ps" type="number" min="0" step="0.01"
                value={ps} onChange={e => setPs(e.target.value)} required />
              <div className="mut" style={{ fontSize: 10.5, marginTop: 3 }}>{inclOf(ps, gst)}</div></div>
            <div><label className="fl">MRP (incl. GST)</label><input className="inp mono" name="mrp" type="number" min="0" step="0.01" defaultValue={item?.mrp ?? ""} /></div>
            {!item && <div><label className="fl">Opening stock</label><input className="inp mono" name="stock" type="number" defaultValue="0" /></div>}
            {item && <div className="full mut" style={{ fontSize: 11.5 }}>
              Stock on existing items changes through Purchases — keeps the books honest.</div>}
            <div><label className="fl">Low-stock alert</label><input className="inp mono" name="low" type="number" defaultValue={item?.low ?? 5} /></div>
            <div className="full" style={{ display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 10 }}>
              <input type="checkbox" id="has_serial" checked={hasSerial}
                onChange={e => setHasSerial(e.target.checked)}
                style={{ width: 18, height: 18 }} />
              <label htmlFor="has_serial" style={{ fontSize: 13, cursor: "pointer" }}>
                <b>This item has serial numbers / IMEI</b>
                <div className="mut" style={{ fontSize: 11.5 }}>
                  When checked, purchases will prompt to enter serials (optional per bill),
                  and sales will offer a picker of in-stock serials.</div>
              </label>
            </div>
          </div>
          {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn pri" disabled={pending || !!dupe}>
              {pending ? "Saving…" : "Save product"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}