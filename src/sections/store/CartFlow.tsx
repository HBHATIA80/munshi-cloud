"use client";
import { useEffect, useState, useTransition } from "react";
import { getCartItems, getShopNames, placeOrderAction } from "./actions";
import { read as readCart, write, shopIds } from "./cartStore";

type Item = { id: string; name: string; sku: string; pr: number; ps: number;
  gst: number; stock: number };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const price = (i: Item, trade: boolean) => (trade ? i.ps : i.pr);

/* ================= CART — grouped per shop ================= */
export function CartView({ trade }: { trade: boolean }) {
  const [groups, setGroups] = useState<{ shop: string; shopId: string;
    rows: { it: Item; qty: number }[] }[] | null>(null);

  useEffect(() => {
    (async () => {
      const ids = shopIds();
      if (!ids.length) { setGroups([]); return; }
      const shops = await getShopNames(ids);
      const out: NonNullable<typeof groups> = [];
      for (const sid of ids) {
        const entries = readCart(sid);
        if (!entries.length) continue;
        const items = await getCartItems(sid, entries.map(e => e.id));
        out.push({
          shop: shops.find(x => x.id === sid)?.name ?? "Shop",
          shopId: sid,
          rows: entries.map(e => ({ it: items.find(i => i.id === e.id)!, qty: e.qty }))
            .filter(r => r.it),
        });
      }
      setGroups(out.filter(g => g.rows.length));
    })();
  }, []);

  if (!groups) return <div className="empty">Loading…</div>;
  if (!groups.length) return (
    <div className="empty"><p>Your cart is empty.</p><br />
      <a className="btn pri" href="/shop">Browse the marketplace</a></div>);

  return (
    <>
      {groups.map(g => {
        const sub = g.rows.reduce((t, r) => t + price(r.it, trade) * r.qty, 0);
        const set = (i: number, q: number) => {
          const c = readCart(g.shopId); c[i].qty = Math.max(1, q); write(g.shopId, c);
          setGroups(gs => gs!.map(x => x.shopId === g.shopId
            ? { ...x, rows: x.rows.map((r, j) => j === i ? { ...r, qty: q } : r) } : x));
        };
        const rm = (i: number) => {
          const c = readCart(g.shopId); c.splice(i, 1); write(g.shopId, c);
          setGroups(gs => gs!.map(x => x.shopId === g.shopId
            ? { ...x, rows: x.rows.filter((_, j) => j !== i) } : x).filter(x => x.rows.length));
        };
        return (
          <div className="panel" style={{ marginBottom: 16 }} key={g.shopId}>
            <div className="ph"><h3>🛒 {g.shop}</h3></div>
            <div className="tblw"><table className="t">
              <thead><tr><th>Product</th><th className="num">Price</th><th>Qty</th>
                <th className="num">Amount</th><th /></tr></thead>
              <tbody>{g.rows.map((r, i) => (
                <tr key={r.it.id}>
                  <td><b>{r.it.name}</b>
                    <div className="mut mono" style={{ fontSize: 11 }}>{r.it.sku}</div></td>
                  <td className="num">{inr(price(r.it, trade))}</td>
                  <td><input className="inp mono" type="number" min={1} style={{ width: 68 }}
                    defaultValue={r.qty} onChange={e => set(i, +e.target.value)} /></td>
                  <td className="num">{inr(price(r.it, trade) * r.qty)}</td>
                  <td><button className="ib" onClick={() => rm(i)}>✕</button></td>
                </tr>))}
              </tbody>
              <tfoot><tr className="tfo"><td colSpan={3}>Subtotal — GST at checkout</td>
                <td className="num">{inr(sub)}</td><td /></tr></tfoot>
            </table></div>
            <div className="pb" style={{ textAlign: "right" }}>
              <a className="btn pri" href={`/checkout?shop=${g.shopId}`}>Checkout this shop →</a>
            </div>
          </div>);
      })}
      <a className="btn" href="/shop">← Keep shopping</a>
    </>
  );
}

/* ================= CHECKOUT — shop-scoped, no gateway ================= */
export function CheckoutForm({ shopId, shopName, trade, homeState, defaultAddr, defaultState }: {
  shopId: string; shopName: string; trade: boolean; homeState: string;
  defaultAddr: string; defaultState: string }) {
  const [rows, setRows] = useState<{ it: Item; qty: number }[] | null>(null);
  const [addr, setAddr] = useState(defaultAddr);
  const [st, setSt] = useState(defaultState || homeState);
  const [pay, setPay] = useState("cod");
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    const entries = readCart(shopId);
    getCartItems(shopId, entries.map(e => e.id)).then(items =>
      setRows(entries.map(e => ({ it: items.find(i => i.id === e.id)!, qty: e.qty }))
        .filter(r => r.it)));
  }, [shopId]);

  if (done) return (
    <div className="panel" style={{ padding: 30, textAlign: "center" }}>
      <div style={{ fontSize: 42 }}>📦</div>
      <h2 style={{ marginTop: 8 }}>Order placed</h2>
      <p className="mut" style={{ fontSize: 13.5, marginTop: 8 }}>
        {pay === "advance"
          ? "The shop will contact you to collect the advance before dispatch."
          : pay === "account"
            ? "The amount is on your account — check your ledger."
            : "Pay cash when the parcel arrives."}
        {" "}The invoice is already on your account.</p>
      <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "center" }}>
        <a className="btn pri" href="/shop">Keep shopping</a>
        <a className="btn" href="/account">My account</a>
      </div>
    </div>);

  if (!rows) return <div className="empty">Loading…</div>;
  if (!rows.length) return (
    <div className="empty"><p>Cart is empty.</p><br />
      <a className="btn pri" href="/shop">Browse the shop</a></div>);

  const inter = st && homeState && st !== homeState;
  const taxable = rows.reduce((t, r) => t + price(r.it, trade) * r.qty, 0);
  const tax = rows.reduce((t, r) => t + price(r.it, trade) * r.qty * r.it.gst / 100, 0);
  const total = Math.round(taxable + tax);

  const place = () => start(async () => {
    setErr("");
    const entries = readCart(shopId);
    const r = await placeOrderAction(shopId, entries, addr, pay);
    if (r.error) { setErr(r.error); return; }
    write(shopId, []);
    setDone(true);
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, alignItems: "start" }}>
      <div className="panel"><div className="pb">
        <h3 style={{ marginBottom: 10 }}>🛒 {shopName}</h3>
        <label className="fl">Delivery address *</label>
        <textarea className="inp" rows={2} value={addr} onChange={e => setAddr(e.target.value)} />
        <div style={{ height: 12 }} />
        <label className="fl">State (decides IGST vs CGST+SGST)</label>
        <input className="inp" value={st} onChange={e => setSt(e.target.value)} />
        <div style={{ marginTop: 14 }}>
          <label className="fl">Payment</label>
          <label style={{ display: "block", margin: "6px 0" }}>
            <input type="radio" checked={pay === "cod"} onChange={() => setPay("cod")} />
            {" "}<b>Cash on Delivery</b> — pay when the parcel arrives</label>
          <label style={{ display: "block", margin: "6px 0" }}>
            <input type="radio" checked={pay === "advance"} onChange={() => setPay("advance")} />
            {" "}<b>Advance on booking</b> — the shop will contact you to collect an advance before dispatch</label>
          {trade && (
            <label style={{ display: "block", margin: "6px 0" }}>
              <input type="radio" checked={pay === "account"} onChange={() => setPay("account")} />
              {" "}<b>Pay on Account</b> — added to your ledger (credit terms)</label>)}
          <p className="mut" style={{ fontSize: 11.5, marginTop: 6 }}>
            Online payment (UPI/card) is coming soon.</p>
        </div>
        {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div></div>

      <div className="panel"><div className="ph"><h3>Summary</h3></div>
        <div className="pb">
          <div className="tot-blk" style={{ width: "100%" }}>
            <div className="tr"><span>Items ({rows.length})</span><b>{inr(taxable)}</b></div>
            <div className="tr"><span>{inter ? "IGST" : "CGST + SGST"}</span><b>{inr(tax)}</b></div>
            <div className="tr gr"><span>Total</span><b>{inr(total)}</b></div>
          </div>
          <button className="btn pri" style={{ width: "100%", justifyContent: "center", marginTop: 12 }}
            disabled={pending || !addr} onClick={place}>
            {pending ? "Placing…" : "Place order"}</button>
          <p className="mut" style={{ fontSize: 10.5, marginTop: 8 }}>
            Placing the order instantly generates a Sales Invoice in the shop's books.</p>
        </div>
      </div>
    </div>
  );
}