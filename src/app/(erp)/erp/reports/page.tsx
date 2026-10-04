import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { partyBalance, type Voucher, type Party } from "@/lib/books";
import { CsvBtn } from "@/lib/CsvBtn";
import { ChartsModal } from "@/sections/reports/PnlCharts";
import Link from "next/link";

const TABS = [["stock", "Stock"], ["out", "Outstanding"], ["gst", "GST"],
  ["pnl", "Profit & Loss"], ["mv", "Item Movement"]] as const;
const PNL_VIEWS = [["sum", "Summary"], ["inv", "By Invoice"], ["item", "By Item"],
  ["cat", "By Category"], ["brand", "By Brand"], ["cust", "By Customer"],
  ["sup", "By Supplier"], ["day", "By Day"]] as const;
const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
const mgn = (p: number, r: number) => (r > 0 ? (p / r * 100).toFixed(1) + "%" : "—");
const TABLE_CAP = 100;
const INV_PAGE = 50;

type Agg = { rev: number; cogs: number; qty: number; n: number; label: string; extra?: string };
function bump(m: Map<string, Agg>, key: string, label: string,
  rev: number, cogs: number, qty: number, n = 1, extra?: string) {
  const a = m.get(key) ?? { rev: 0, cogs: 0, qty: 0, n: 0, label, extra };
  a.rev = Math.round((a.rev + rev) * 100) / 100;
  a.cogs = Math.round((a.cogs + cogs) * 100) / 100;
  a.qty += qty; a.n += n;
  if (extra !== undefined) a.extra = extra;
  m.set(key, a);
}

export default async function ReportsPage({ searchParams }: {
  searchParams: Promise<{ tab?: string; from?: string; to?: string; v?: string;
    q?: string; pg?: string; size?: string; item?: string; n?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const sb = await createClient();

  // ── canonical params ──
  const tab = ["stock", "out", "gst", "pnl", "mv"].includes(sp.tab || "") ? sp.tab! : "stock";
  const to = sp.to || new Date().toISOString().slice(0, 10);
  const from = sp.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const pnlView = (PNL_VIEWS.map(v => v[0]).includes(sp.v || "") ? sp.v : "sum")!;
  const q = (sp.q || "").trim();
  const size = Math.min(200, Math.max(10, +(sp.size || 25) || 25));
  const pg = Math.max(1, +(sp.pg || 1) || 1);
  const itemId = sp.item || "";
  const nLimit = Math.min(100, Math.max(1, +(sp.n || 10) || 10));

  // ONE link builder — every link/form derives from this; dates are never dropped
  const qlink = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams({ tab, from, to });
    if (tab === "pnl") params.set("v", pnlView);
    if (tab === "mv") { if (itemId) params.set("item", itemId); params.set("n", String(nLimit)); }
    if (q) params.set("q", q);
    if (size !== 25) params.set("size", String(size));
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === "") params.delete(k); else params.set(k, String(v));
    }
    return `/erp/reports?${params.toString()}`;
  };

  const [{ data: items }, { data: parties }, { data: vs }, { data: expenses },
    { data: cats }, { data: brands }] = await Promise.all([
    sb.from("items").select("id,name,sku,cat_id,sub_id,brand_id,cost")
      .eq("tenant_id", s.tenantId).order("name"),
    sb.from("parties").select("*").eq("tenant_id", s.tenantId),
    sb.from("vouchers").select("*").eq("tenant_id", s.tenantId),
    sb.from("expenses").select("head,amount,date").eq("tenant_id", s.tenantId)
      .gte("date", from).lte("date", to),
    sb.from("categories").select("id,name").eq("tenant_id", s.tenantId),
    sb.from("brands").select("id,name").eq("tenant_id", s.tenantId),
  ]);
  const V = (vs ?? []) as unknown as Voucher[];
  const Vwin = V.filter(v => v.date >= from && v.date <= to);
  const Vbal = V.filter(v => v.date <= to);
  const P = (parties ?? []) as unknown as Party[];
  const IT = (items ?? []) as any[];
  const EX = (expenses ?? []) as { head: string; amount: number; date: string }[];

  return (
    <>
      {/* ── toolbar: tabs + dates (form carries tab/v/item/n via hidden inputs) ── */}
      <div className="tool" style={{ flexWrap: "wrap" }}>
        {TABS.map(([k, l]) => (
          <Link key={k} className={"fchip" + (tab === k ? " on" : "")}
            href={qlink({ tab: k, pg: 1 })}>{l}</Link>))}
        <form method="get" action="/erp/reports"
          style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <input type="hidden" name="tab" value={tab} />
          {tab === "pnl" && <input type="hidden" name="v" value={pnlView} />}
          {tab === "mv" && <input type="hidden" name="item" value={itemId} />}
          {tab === "mv" && <input type="hidden" name="n" value={String(nLimit)} />}
          <label className="mut" style={{ fontSize: 12 }}>From</label>
          <input className="inp mono" type="date" name="from" defaultValue={from} style={{ width: 135 }} />
          <label className="mut" style={{ fontSize: 12 }}>To</label>
          <input className="inp mono" type="date" name="to" defaultValue={to} style={{ width: 135 }} />
          <button className="btn sm" type="submit">Go</button>
          {(from !== new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10) ||
            to !== new Date().toISOString().slice(0, 10)) && (
            <Link className="btn sm" href={qlink({ from: "", to: "", pg: 1 })}>✕ dates</Link>)}
        </form>
      </div>

      {tab === "stock" && (() => {
        const I = IT;
        return (
          <div className="panel">
            <div className="ph"><h3>Stock valuation</h3>
              <CsvBtn name="stock.csv" rows={[["Item", "SKU", "Stock", "Cost", "Value"],
                ...I.map((i: any) => [i.name, i.sku, i.stock ?? 0, i.cost ?? 0,
                  Math.round((i.stock ?? 0) * (i.cost ?? 0))])]} />
            </div>
            <div className="tblw"><table className="t">
              <thead><tr><th>Item</th><th className="num">Stock</th><th className="num">Cost</th>
                <th className="num">Value</th><th>Status</th></tr></thead>
              <tbody>
                {I.map((i: any, ix: number) => (
                  <tr key={ix}>
                    <td><b>{i.name}</b></td>
                    <td className="num">{i.stock ?? 0}</td>
                    <td className="num">{inr(i.cost)}</td>
                    <td className="num">{inr((i.stock ?? 0) * (i.cost ?? 0))}</td>
                    <td><span className={"chip " + ((i.stock ?? 0) <= 0 ? "red" : (i.stock ?? 0) <= (i.low ?? 0) ? "amb" : "grn")}>
                      {(i.stock ?? 0) <= 0 ? "out" : (i.stock ?? 0) <= (i.low ?? 0) ? "low" : "ok"}</span></td>
                  </tr>))}
                {!I.length && <tr><td colSpan={5}><div className="empty">No items yet.</div></td></tr>}
              </tbody>
            </table></div>
          </div>
        );
      })()}

      {tab === "out" && (() => {
        const ql = q.toLowerCase();
        const rows = P.map(p => ({ p, b: partyBalance(Vbal, p) }))
          .filter(r => Math.abs(r.b) >= .01)
          .filter(r => !ql || r.p.name.toLowerCase().includes(ql) ||
            r.p.type.toLowerCase().includes(ql) || (r.p.mobile ?? "").includes(ql))
          .sort((a, b) => Math.abs(b.b) - Math.abs(a.b));
        const totThey = Math.round(rows.reduce((t, r) => t + Math.max(r.b, 0), 0) * 100) / 100;
        const totWe = Math.round(rows.reduce((t, r) => t + Math.max(-r.b, 0), 0) * 100) / 100;
        const net = Math.round((totThey - totWe) * 100) / 100;
        const health = net > 0.5
          ? { cls: "grn", tag: "HEALTHY", msg: "Receivables exceed payables." }
          : net < -0.5
          ? { cls: "red", tag: "STRAINED", msg: "Payables exceed receivables — collect faster." }
          : { cls: "", tag: "BALANCED", msg: "Roughly equal." };
        const pages = Math.max(1, Math.ceil(rows.length / size));
        const curPg = Math.min(pg, pages);
        const view = rows.slice((curPg - 1) * size, curPg * size);
        return (
          <div className="panel">
            <div className="ph"><h3>Who owes what <span className="mut" style={{ fontSize: 12 }}>as of {to}</span></h3>
              <CsvBtn name="outstanding.csv" rows={[
                ["Party", "Type", "They owe", "We owe"],
                ...rows.map(r => [r.p.name, r.p.type, r.b > 0 ? Math.round(r.b) : "", r.b < 0 ? Math.round(-r.b) : ""]),
                ["TOTAL", "", Math.round(totThey), Math.round(totWe)],
              ]} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "12px 16px",
              borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: "1 1 150px" }}>
                <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>They owe us</div>
                <b style={{ font: "600 22px var(--font-disp)", color: "var(--green, #1a7f37)" }}>{inr(totThey)}</b></div>
              <div style={{ flex: "1 1 150px" }}>
                <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>We owe</div>
                <b style={{ font: "600 22px var(--font-disp)", color: "var(--red, #c62828)" }}>{inr(totWe)}</b></div>
              <div style={{ flex: "1 1 150px" }}>
                <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Net</div>
                <b style={{ font: "600 22px var(--font-disp)",
                  color: net >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)" }}>
                  {net >= 0 ? "+" : "−"}{inr(Math.abs(net))}</b></div>
              <div style={{ flex: "2 1 240px", display: "flex", flexDirection: "column",
                justifyContent: "center", gap: 4 }}>
                <span className={"chip " + health.cls} style={{ alignSelf: "flex-start" }}>{health.tag}</span>
                <span className="mut" style={{ fontSize: 12 }}>{health.msg}</span></div>
            </div>
            <form method="get" action="/erp/reports" style={{ display: "flex", gap: 6,
              padding: "10px 16px 0", flexWrap: "wrap" }}>
              <input type="hidden" name="tab" value="out" />
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <input type="hidden" name="size" value={String(size)} />
              <input className="inp" name="q" defaultValue={q}
                placeholder="Search party / type / mobile…" style={{ maxWidth: 240 }} />
              <button className="btn sm" type="submit">Search</button>
              {q && <Link className="btn sm" href={qlink({ q: "", pg: 1 })}>✕ Clear</Link>}
            </form>
            <div className="tblw" style={{ marginTop: 8 }}><table className="t">
              <thead><tr><th>Party</th><th>Type</th><th className="num">They owe</th><th className="num">We owe</th></tr></thead>
              <tbody>
                {view.map((r, i) => (
                  <tr key={r.p.id}>
                    <td><b>{r.p.name}</b></td>
                    <td><span className="chip">{r.p.type}</span></td>
                    <td className="num pos">{r.b > 0 ? inr(r.b) : ""}</td>
                    <td className="num neg">{r.b < 0 ? inr(-r.b) : ""}</td>
                  </tr>))}
                {!view.length && <tr><td colSpan={4}><div className="empty">All settled.</div></td></tr>}
              </tbody>
              <tfoot>
                <tr className="tfo"><td colSpan={2}>Totals</td>
                  <td className="num pos">{inr(totThey)}</td><td className="num neg">{inr(totWe)}</td></tr>
                <tr className="tfo"><td colSpan={2}>Net (they − we)</td>
                  <td className="num" colSpan={2}>{net >= 0 ? "+" : "−"}{inr(Math.abs(net))}</td></tr>
              </tfoot>
            </table></div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "10px 16px 12px" }}>
              <span className="mut" style={{ fontSize: 12 }}>
                {rows.length ? `Showing ${(curPg - 1) * size + 1}–${Math.min(curPg * size, rows.length)} of ${rows.length}` : "Nothing to show"}
              </span>
              <div style={{ display: "flex", gap: 6 }}>
                <Link className={"btn sm" + (curPg <= 1 ? " dis" : "")}
                  href={qlink({ pg: curPg > 1 ? curPg - 1 : undefined })}>← Prev</Link>
                <span className="mut" style={{ fontSize: 12 }}>Page {curPg} / {pages}</span>
                <Link className={"btn sm" + (curPg >= pages ? " dis" : "")}
                  href={qlink({ pg: curPg < pages ? curPg + 1 : undefined })}>Next →</Link>
              </div>
            </div>
          </div>
        );
      })()}

      {tab === "gst" && (() => {
        const bySlab: Record<number, { t: number; x: number }> = {};
        Vwin.filter(v => v.type === "sale" && v.is_gst).forEach(v =>
          (v.lines ?? []).forEach(l => {
            const net = l.qty * l.rate * (1 - (l.disc || 0) / 100);
            bySlab[l.gst] = bySlab[l.gst] ?? { t: 0, x: 0 };
            bySlab[l.gst].t += net;
            bySlab[l.gst].x += net * l.gst / 100;
          }));
        const inTax = Vwin.filter(v => v.type === "purchase").reduce((t, v) => t + +v.tax, 0);
        const keys = Object.keys(bySlab).map(Number).sort((a, b) => a - b);
        const oT = keys.reduce((t, k) => t + bySlab[k].x, 0);
        const net = oT - inTax;
        return (
          <div className="panel">
            <div className="ph"><h3>GST summary <span className="mut" style={{ fontSize: 12 }}>{from} → {to}</span></h3>
              <span className={"chip " + (net > 0 ? "red" : "grn")}>
                {net > 0 ? "Net payable " + inr(net) : "Credit carried " + inr(-net)}</span>
            </div>
            <div className="tblw"><table className="t">
              <thead><tr><th>Slab</th><th className="num">Taxable</th><th className="num">CGST</th><th className="num">SGST</th></tr></thead>
              <tbody>
                {keys.map(k => (
                  <tr key={k}>
                    <td><b>{k}%</b></td>
                    <td className="num">{inr(bySlab[k].t)}</td>
                    <td className="num">{inr(bySlab[k].x / 2)}</td>
                    <td className="num">{inr(bySlab[k].x / 2)}</td>
                  </tr>))}
                {!keys.length && <tr><td colSpan={4}><div className="empty">No GST sales in range.</div></td></tr>}
              </tbody>
              <tfoot>
                <tr className="tfo"><td>Output tax</td><td /><td className="num" colSpan={2}>{inr(oT)}</td></tr>
                <tr className="tfo"><td>Input credit</td><td /><td className="num" colSpan={2}>{inr(inTax)}</td></tr>
                <tr className="tfo"><td>Net {net > 0 ? "payable" : "credit"}</td><td /><td className="num" colSpan={2}>{inr(Math.abs(net))}</td></tr>
              </tfoot>
            </table></div>
          </div>
        );
      })()}

      {tab === "mv" && (() => {
        // ── ITEM MOVEMENT: last N purchases + last N sales for ONE item ──
        const item = IT.find(x => x.id === itemId);
        const pu: { no: string; date: string; qty: number; rate: number; party: string }[] = [];
        const so: { no: string; date: string; qty: number; rate: number; party: string; ret: boolean }[] = [];
        if (itemId) {
          const chrono = [...V].sort((a, b) => a.date.localeCompare(b.date)); // newest last → pop newest first
          const pn = P.reduce<Map<string, string>>((m, p) => m.set(p.id, p.name), new Map());
          for (const v of chrono.reverse()) {
            for (const l of (v.lines ?? []) as any[]) {
              if (l.item_id !== itemId) continue;
              if ((v.type === "purchase") && pu.length < nLimit)
                pu.push({ no: v.no, date: v.date, qty: +l.qty, rate: +l.rate,
                  party: pn.get(v.party_id ?? "") ?? "Cash" });
              if ((v.type === "sale" || v.type === "salret") && so.length < nLimit)
                so.push({ no: v.no, date: v.date, qty: +l.qty, rate: +l.rate,
                  party: pn.get(v.party_id ?? "") ?? "Counter",
                  ret: v.type === "salret" });
            }
          }
        }
        const lastPu = pu[0] ?? null, lastSo = so.filter(x => !x.ret)[0] ?? null;
        const margin = lastPu && lastSo ? Math.round((lastSo.rate - lastPu.rate) * 100) / 100 : null;

        return (
          <div className="panel">
            <div className="ph">
              <h3>Item movement — purchase &amp; sales trail</h3>
              <span className="mut" style={{ fontSize: 12 }}>all-time · latest {nLimit} each side</span>
            </div>

            {/* picker + limit */}
            <form method="get" action="/erp/reports" style={{ display: "flex", gap: 8,
              flexWrap: "wrap", alignItems: "center", padding: "12px 16px 0" }}>
              <input type="hidden" name="tab" value="mv" />
              <label className="fl">Item</label>
              <select className="inp" name="item" defaultValue={itemId} style={{ maxWidth: 340 }} required>
                <option value="">Select an item…</option>
                {IT.map((i: any) => (
                  <option key={i.id} value={i.id}>{i.name}{i.sku ? ` · ${i.sku}` : ""}</option>))}
              </select>
              <label className="fl">Entries</label>
              <select className="inp mono" name="n" defaultValue={String(nLimit)} style={{ width: 90 }}>
                {[5, 10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <button className="btn pri sm" type="submit">Show</button>
            </form>

            {!itemId && <div className="empty" style={{ margin: 14 }}>
              Pick an item above — its latest purchases (supplier, rate) and sales
              (customer, rate) appear side by side.</div>}

            {item && (
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: "14px 16px 4px" }}>
                <div style={{ flex: "1 1 200px" }}>
                  <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Item</div>
                  <b style={{ fontSize: 15 }}>{item.name}</b>
                  {item.sku && <div className="mut mono" style={{ fontSize: 11 }}>{item.sku}</div>}
                </div>
                <div style={{ flex: "1 1 150px" }}>
                  <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Last purchase</div>
                  <b style={{ fontSize: 15 }}>{lastPu ? inr(lastPu.rate) : "—"}</b>
                  {lastPu && <div className="mut" style={{ fontSize: 11 }}>{lastPu.party} · {lastPu.date}</div>}
                </div>
                <div style={{ flex: "1 1 150px" }}>
                  <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Last sold</div>
                  <b style={{ fontSize: 15 }}>{lastSo ? inr(lastSo.rate) : "—"}</b>
                  {lastSo && <div className="mut" style={{ fontSize: 11 }}>{lastSo.party} · {lastSo.date}</div>}
                </div>
                <div style={{ flex: "1 1 150px" }}>
                  <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Implied margin</div>
                  {margin !== null
                    ? <b style={{ fontSize: 15, color: margin >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)" }}>
                        {inr(margin)} {lastPu && lastSo && lastSo.rate > 0
                          ? `(${mgn(lastSo.rate - lastPu.rate, lastSo.rate)})` : ""}</b>
                    : <b style={{ fontSize: 15 }}>—</b>}
                  <div className="mut" style={{ fontSize: 11 }}>last buy vs last sale</div>
                </div>
                {item.cost != null && lastPu && item.cost !== lastPu.rate && (
                  <div style={{ flex: "1 1 150px" }}>
                    <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Master cost</div>
                    <b style={{ fontSize: 15 }}>{inr(item.cost)}</b>
                    <span className="chip amb" style={{ marginLeft: 6 }}
                      title="Item master cost differs from the latest purchase bill">drift</span>
                  </div>)}
              </div>)}

            {itemId && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
                gap: 12, padding: "14px 16px 16px" }}>
                {/* purchases */}
                <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <b>🛒 Last purchases ({pu.length})</b>
                    <CsvBtn name="item-purchases.csv" rows={[["Bill", "Date", "Supplier", "Qty", "Rate"],
                      ...pu.map(p => [p.no, p.date, p.party, p.qty, p.rate])]} />
                  </div>
                  <table className="t" style={{ fontSize: 12 }}>
                    <thead><tr><th>Bill</th><th>Date</th><th>Supplier</th>
                      <th className="num">Qty</th><th className="num">Rate</th></tr></thead>
                    <tbody>
                      {pu.map((p, i) => (
                        <tr key={p.no + i}>
                          <td className="mono" style={{ fontSize: 11 }}>{p.no}</td>
                          <td style={{ fontSize: 11 }}>{p.date}</td>
                          <td style={{ fontSize: 11.5 }}>{p.party}</td>
                          <td className="num">{p.qty}</td>
                          <td className="num" style={{ fontWeight: i === 0 ? 700 : 400 }}>
                            {inr(p.rate)}{i === 0 &&
                              <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
                          </td>
                        </tr>))}
                      {!pu.length && <tr><td colSpan={5}><div className="empty">No purchases recorded.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
                {/* sales */}
                <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <b>🧾 Last sales ({so.length})</b>
                    <CsvBtn name="item-sales.csv" rows={[["Invoice", "Date", "Customer", "Qty", "Rate"],
                      ...so.map(p => [p.no, p.date, p.party, p.qty, p.rate])]} />
                  </div>
                  <table className="t" style={{ fontSize: 12 }}>
                    <thead><tr><th>Invoice</th><th>Date</th><th>Customer</th>
                      <th className="num">Qty</th><th className="num">Rate</th></tr></thead>
                    <tbody>
                      {so.map((p, i) => (
                        <tr key={p.no + i}>
                          <td className="mono" style={{ fontSize: 11 }}>{p.no}
                            {p.ret && <span className="chip red" style={{ fontSize: 9, marginLeft: 4 }}>ret</span>}</td>
                          <td style={{ fontSize: 11 }}>{p.date}</td>
                          <td style={{ fontSize: 11.5 }}>{p.party}</td>
                          <td className="num">{p.ret ? `−${p.qty}` : p.qty}</td>
                          <td className="num" style={{ fontWeight: i === 0 && !p.ret ? 700 : 400 }}>
                            {inr(p.rate)}{i === 0 && !p.ret &&
                              <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
                          </td>
                        </tr>))}
                      {!so.length && <tr><td colSpan={5}><div className="empty">No sales recorded.</div></td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>)}
          </div>
        );
      })()}

      {tab === "pnl" && (() => {
        const nameOf = (id: unknown) => P.find(x => x.id === id)?.name ?? "Counter / Cash";
        const catName = new Map<string, string>((cats ?? []).map((c: any) => [String(c.id), c.name]));
        const brandName = new Map<string, string>((brands ?? []).map((b: any) => [String(b.id), b.name]));
        const catLabelOf = (it: any) => {
          const c = catName.get(String(it?.cat_id ?? "")) ?? "Uncategorised";
          const s2 = it?.sub_id ? catName.get(String(it.sub_id)) : null;
          return s2 && s2 !== c ? `${c} › ${s2}` : c;
        };
        const catById = new Map<string, string>(), brandById = new Map<string, string>();
        IT.forEach(i => {
          catById.set(i.id, catLabelOf(i));
          brandById.set(i.id, brandName.get(String(i?.brand_id ?? "")) ?? "Unbranded");
        });
        const lineNetRaw = (l: any) =>
          l._net != null ? +l._net : Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;

        const mItem = new Map<string, Agg>(), mCat = new Map<string, Agg>(),
          mBrand = new Map<string, Agg>(), mCust = new Map<string, Agg>(),
          mDay = new Map<string, Agg>(), mSup = new Map<string, Agg>();
        let rev = 0, cogs = 0, invN = 0;
        type Inv = { id: string; no: string; date: string; party: string; ret: boolean;
          rev: number; cogs: number; p: number };
        const invRows: Inv[] = [];

        for (const v of Vwin) {
          if (v.type === "sale" || v.type === "salret") {
            const isRet = v.type === "salret";
            const lines = (v.lines ?? []) as any[];
            const gross = lines.reduce((t, l) => t + lineNetRaw(l), 0);
            const netT = +v.taxable || gross;
            const vCost = lines.reduce((t, l) => t + (l.cost ?? 0) * l.qty, 0);
            const sign = isRet ? -1 : 1;
            const f = !isRet && gross > 0 ? netT / gross : 1;
            if (!isRet) {
              invN++;
              for (const l of lines) {
                const net = Math.round(lineNetRaw(l) * f * 100) / 100;
                const cost = (l.cost ?? 0) * l.qty;
                rev += net; cogs += cost;
                const iid = l.item_id || l.name;
                bump(mItem, iid, l.name || "Unknown item", net, cost, l.qty);
                const cl = catById.get(String(l.item_id)) ?? "Uncategorised";
                bump(mCat, cl, cl, net, cost, l.qty);
                const bl = brandById.get(String(l.item_id)) ?? "Unbranded";
                bump(mBrand, bl, bl, net, cost, l.qty);
                bump(mCust, v.party_id ?? "counter", nameOf(v.party_id), net, cost, l.qty, 1,
                  v.party_id ? (P.find(x => x.id === v.party_id)?.type ?? "") : "counter");
              }
              bump(mDay, v.date, v.date, Math.round(netT * 100) / 100, vCost, 0);
            } else {
              for (const l of lines) {
                const net = lineNetRaw(l), cost = (l.cost ?? 0) * l.qty;
                rev -= net; cogs -= cost;
                const iid = l.item_id || l.name;
                bump(mItem, iid, l.name || "Unknown item", -net, -cost, -l.qty);
                const cl = catById.get(String(l.item_id)) ?? "Uncategorised";
                bump(mCat, cl, cl, -net, -cost, -l.qty);
                const bl = brandById.get(String(l.item_id)) ?? "Unbranded";
                bump(mBrand, bl, bl, -net, -cost, -l.qty);
                bump(mCust, v.party_id ?? "counter", nameOf(v.party_id), -net, -cost, -l.qty, 0,
                  v.party_id ? (P.find(x => x.id === v.party_id)?.type ?? "") : "counter");
              }
              bump(mDay, v.date, v.date, -(+v.taxable || 0), -vCost, 0, 0);
            }
            invRows.push({ id: v.id, no: v.no, date: v.date, party: nameOf(v.party_id), ret: isRet,
              rev: Math.round(netT * sign * 100) / 100,
              cogs: Math.round(vCost * sign * 100) / 100, p: 0 });
          }
          if (v.type === "purchase")
            bump(mSup, v.party_id ?? "?", nameOf(v.party_id), +v.taxable, 0, 0, 1);
          if (v.type === "purret")
            bump(mSup, v.party_id ?? "?", nameOf(v.party_id), 0, +v.taxable, 0, 0);
        }
        rev = Math.round(rev * 100) / 100; cogs = Math.round(cogs * 100) / 100;
        const gross = Math.round((rev - cogs) * 100) / 100;
        const expT = Math.round(EX.reduce((t, e) => t + +e.amount, 0) * 100) / 100;
        const np = Math.round((gross - expT) * 100) / 100;

        invRows.forEach(r => { r.p = Math.round((r.rev - r.cogs) * 100) / 100; });
        invRows.sort((a, b) => b.date.localeCompare(a.date) || a.no.localeCompare(b.no));
        const invRev = Math.round(invRows.reduce((t, r) => t + r.rev, 0) * 100) / 100;
        const invCogs = Math.round(invRows.reduce((t, r) => t + r.cogs, 0) * 100) / 100;
        const invP = Math.round(invRows.reduce((t, r) => t + r.p, 0) * 100) / 100;

        const byHead: Record<string, number> = {};
        EX.forEach(e => { byHead[e.head] = (byHead[e.head] ?? 0) + +e.amount; });
        const heads = Object.entries(byHead).sort((a, b) => b[1] - a[1]);

        const withP = (m: Map<string, Agg>) => [...m.values()]
          .map(a => ({ ...a, p: Math.round((a.rev - a.cogs) * 100) / 100 }));
        const itemRows = withP(mItem).sort((a, b) => b.p - a.p);
        const catRows = withP(mCat).sort((a, b) => b.p - a.p);
        const brandRows = withP(mBrand).sort((a, b) => b.p - a.p);
        const custRows = withP(mCust).sort((a, b) => b.p - a.p);
        const supRows = [...mSup.values()]
          .map(a => ({ ...a, net: Math.round((a.rev - a.cogs) * 100) / 100 }))
          .sort((a, b) => b.net - a.net);
        const expByDay: Record<string, number> = {};
        EX.forEach(e => { expByDay[e.date] = (expByDay[e.date] ?? 0) + +e.amount; });
        const dayRows = [...mDay.values()].map(a => {
          const ex = Math.round((expByDay[a.label] ?? 0) * 100) / 100;
          return { ...a, ex, net: Math.round((a.rev - a.cogs - ex) * 100) / 100 };
        }).sort((a, b) => b.label.localeCompare(a.label));

        const topItem = itemRows[0], worstItem = itemRows[itemRows.length - 1];
        const topCust = custRows[0], topCat = catRows[0];
        const bestDay = [...dayRows].sort((a, b) => b.rev - b.cogs - (a.rev - a.cogs))[0];

        const dayAsc = [...dayRows].sort((a, b) => a.label.localeCompare(b.label));
        const chartDaily = dayAsc.map(d => ({ label: d.label, rev: d.rev, cogs: d.cogs, net: d.net }));
        const chartItems = itemRows.slice(0, 12).map(a => ({ label: a.label, value: a.p }));
        const chartCats = catRows.slice(0, 10).map(a => ({ label: a.label, value: a.p }));
        const chartBrands = brandRows.slice(0, 10).map(a => ({ label: a.label, value: a.p }));
        const chartCust = custRows.slice(0, 10).map(a => ({ label: a.label, value: a.p }));
        const chartSup = supRows.slice(0, 10).map(a => ({ label: a.label, value: a.net,
          color: "var(--blu, #2b6cb0)" }));
        const invByProfit = [...invRows].sort((a, b) => b.p - a.p);
        const chartInv = [
          ...invByProfit.slice(0, 8).map(r => ({ label: r.no, value: r.p })),
          ...invByProfit.slice(-5).filter(r => r.p < 0).map(r => ({ label: r.no, value: r.p })),
        ].filter((x, i, arr) => arr.findIndex(y => y.label === x.label) === i);

        const ql = q.toLowerCase();
        const invFiltered = ql
          ? invRows.filter(r => (r.no + " " + r.party).toLowerCase().includes(ql))
          : invRows;
        const invPages = Math.max(1, Math.ceil(invFiltered.length / INV_PAGE));
        const pgCur = Math.min(pg, invPages);
        const invPage = invFiltered.slice((pgCur - 1) * INV_PAGE, pgCur * INV_PAGE);

        const dimSearch = <T extends { label: string }>(rows: T[]) => ql
          ? rows.filter(a => a.label.toLowerCase().includes(ql)) : rows;
        const capNote = (n: number) => n > TABLE_CAP
          ? <p className="mut" style={{ fontSize: 11.5, padding: "6px 12px" }}>
              Showing top {TABLE_CAP} by profit of {n.toLocaleString("en-IN")} — full list in CSV.</p>
          : null;
        const itemTbl = dimSearch(itemRows).slice(0, TABLE_CAP);
        const catTbl = dimSearch(catRows).slice(0, TABLE_CAP);
        const brandTbl = dimSearch(brandRows).slice(0, TABLE_CAP);
        const custTbl = dimSearch(custRows).slice(0, TABLE_CAP);

        return (
          <div className="panel">
            <div className="ph">
              <h3>Profit &amp; Loss <span className="mut" style={{ fontSize: 12 }}>{from} → {to}</span></h3>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center",
              padding: "10px 16px 0" }}>
              {PNL_VIEWS.map(([k, l]) => (
                <Link key={k} className={"fchip" + (pnlView === k ? " on" : "")}
                  href={qlink({ v: k, pg: 1 })}>{l}</Link>))}
              <span style={{ flex: 1 }} />
              <ChartsModal view={pnlView} daily={chartDaily} items={chartItems} cats={chartCats}
                brands={chartBrands} custs={chartCust} sups={chartSup} invs={chartInv} />
            </div>

            <form method="get" action="/erp/reports" style={{ display: "flex", gap: 6,
              padding: "10px 16px 0", flexWrap: "wrap" }}>
              <input type="hidden" name="tab" value="pnl" />
              <input type="hidden" name="v" value={pnlView} />
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <input type="hidden" name="size" value={String(size)} />
              <input className="inp" name="q" defaultValue={q}
                placeholder={`Search ${pnlView === "inv" ? "invoice no / party" : "name"}…`}
                style={{ maxWidth: 230 }} />
              <button className="btn sm" type="submit">Search</button>
              {q && <Link className="btn sm" href={qlink({ q: "", pg: 1 })}>✕ Clear</Link>}
            </form>

            {pnlView === "sum" && (
              <div className="pb">
                <div className="led-row"><span>Sales revenue (net of returns &amp; bill discounts)</span><b>{inr(rev)}</b></div>
                <div className="led-row"><span>− Cost of goods sold</span><b>({inr(cogs)})</b></div>
                <div className="led-row"><span><b>Gross profit</b> <span className="mut">({mgn(gross, rev)} margin · {invN} invoices)</span></span>
                  <b className={gross >= 0 ? "pos" : "neg"}>{inr(gross)}</b></div>
                <div className="led-row"><span>− Operating expenses</span><b>({inr(expT)})</b></div>
                {heads.map(([h, v]) => (
                  <div className="led-row" key={h} style={{ paddingLeft: 18 }}>
                    <span className="mut" style={{ fontSize: 12.5 }}>{h}</span>
                    <b className="mut" style={{ fontSize: 12 }}>({inr(v)})</b>
                  </div>))}
                <div className="led-row" style={{ borderTop: "2px solid var(--line2)", marginTop: 4 }}>
                  <span><b>Net profit</b> <span className="mut">({mgn(np, rev)} of revenue)</span></span>
                  <b style={{ fontSize: 19 }} className={np >= 0 ? "pos" : "neg"}>{inr(np)}</b>
                </div>

                {(topItem || topCust || topCat || bestDay) && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                    gap: 10, marginTop: 14 }}>
                    {topItem && topItem.p > 0 && (
                      <div className="panel" style={{ padding: 10 }}>
                        <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Top item</div>
                        <b style={{ fontSize: 13 }}>{topItem.label}</b>
                        <div className="pos" style={{ fontSize: 12.5 }}>{inr(topItem.p)} · {mgn(topItem.p, topItem.rev)}</div>
                      </div>)}
                    {worstItem && worstItem.p < 0 && (
                      <div className="panel" style={{ padding: 10 }}>
                        <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Losing item</div>
                        <b style={{ fontSize: 13 }}>{worstItem.label}</b>
                        <div className="neg" style={{ fontSize: 12.5 }}>{inr(worstItem.p)} — review price/cost</div>
                      </div>)}
                    {topCat && topCat.p > 0 && (
                      <div className="panel" style={{ padding: 10 }}>
                        <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Top category</div>
                        <b style={{ fontSize: 13 }}>{topCat.label}</b>
                        <div className="pos" style={{ fontSize: 12.5 }}>{inr(topCat.p)} · {mgn(topCat.p, topCat.rev)}</div>
                      </div>)}
                    {topCust && topCust.p > 0 && (
                      <div className="panel" style={{ padding: 10 }}>
                        <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Best customer</div>
                        <b style={{ fontSize: 13 }}>{topCust.label}</b>
                        <div className="pos" style={{ fontSize: 12.5 }}>{inr(topCust.p)} profit</div>
                      </div>)}
                    {bestDay && (
                      <div className="panel" style={{ padding: 10 }}>
                        <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Best day</div>
                        <b style={{ fontSize: 13 }}>{bestDay.label}</b>
                        <div style={{ fontSize: 12.5 }}>Gross {inr(bestDay.rev - bestDay.cogs)}</div>
                      </div>)}
                  </div>
                )}

                <p className="mut" style={{ fontSize: 11.5, marginTop: 12 }}>
                  GST excluded. Bill discounts allocated proportionally, so every dimension view
                  reconciles to Gross profit. New: the <b>Item Movement</b> tab traces any item's
                  last purchases &amp; sales.</p>
              </div>
            )}

            {pnlView === "inv" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-invoice.csv" rows={[["Date", "Invoice", "Party", "Type", "Revenue", "COGS", "Profit", "Margin"],
                    ...invFiltered.map(r => [r.date, r.no, r.party, r.ret ? "return" : "invoice",
                      Math.round(r.rev), Math.round(r.cogs), r.p, mgn(r.p, r.rev)])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Date</th><th>No</th><th>Party</th>
                    <th className="num">Revenue</th><th className="num">COGS</th>
                    <th className="num">Profit</th><th className="num">Margin</th></tr></thead>
                  <tbody>
                    {invPage.map(r => (
                      <tr key={r.id}>
                        <td>{r.date}</td>
                        <td className="mono"><b>{r.no}</b>
                          {r.ret && <span className="chip red" style={{ marginLeft: 6 }}>return</span>}</td>
                        <td>{r.party}</td>
                        <td className="num">{inr(r.rev)}</td>
                        <td className="num">{inr(r.cogs)}</td>
                        <td className={"num " + (r.p >= 0 ? "pos" : "neg")}><b>{inr(r.p)}</b></td>
                        <td className="num">{mgn(r.p, r.rev)}</td>
                      </tr>))}
                    {!invPage.length && <tr><td colSpan={7}><div className="empty">No invoices match.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td colSpan={3}>Totals — all {invFiltered.length} documents</td>
                    <td className="num">{inr(invRev)}</td>
                    <td className="num">{inr(invCogs)}</td>
                    <td className="num">{inr(invP)}</td>
                    <td className="num">{mgn(invP, invRev)}</td></tr></tfoot>
                </table></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 16px 12px" }}>
                  <span className="mut" style={{ fontSize: 12 }}>
                    {invFiltered.length
                      ? `Showing ${(pgCur - 1) * INV_PAGE + 1}–${Math.min(pgCur * INV_PAGE, invFiltered.length)} of ${invFiltered.length}`
                      : "Nothing to show"}
                  </span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <Link className={"btn sm" + (pgCur <= 1 ? " dis" : "")}
                      href={qlink({ pg: pgCur > 1 ? pgCur - 1 : undefined })}>← Prev</Link>
                    <span className="mut" style={{ fontSize: 12 }}>Page {pgCur} / {invPages}</span>
                    <Link className={"btn sm" + (pgCur >= invPages ? " dis" : "")}
                      href={qlink({ pg: pgCur < invPages ? pgCur + 1 : undefined })}>Next →</Link>
                  </div>
                </div>
              </>
            )}

            {pnlView === "item" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-item.csv" rows={[["Item", "Qty sold", "Revenue", "COGS", "Profit", "Margin"],
                    ...itemRows.map(a => [a.label, a.qty, Math.round(a.rev), Math.round(a.cogs), a.p, mgn(a.p, a.rev)])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Revenue</th>
                    <th className="num">COGS</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead>
                  <tbody>
                    {itemTbl.map((a, i) => (
                      <tr key={i}><td><b>{a.label}</b></td>
                        <td className="num">{a.qty}</td>
                        <td className="num">{inr(a.rev)}</td>
                        <td className="num">{inr(a.cogs)}</td>
                        <td className={"num " + (a.p >= 0 ? "pos" : "neg")}><b>{inr(a.p)}</b></td>
                        <td className="num">{mgn(a.p, a.rev)}</td></tr>))}
                    {!itemTbl.length && <tr><td colSpan={6}><div className="empty">No sales in range.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td colSpan={3}>Totals (all items)</td>
                    <td className="num">{inr(cogs)}</td>
                    <td className="num">{inr(gross)}</td>
                    <td className="num">{mgn(gross, rev)}</td></tr></tfoot>
                </table></div>
                {capNote(itemRows.length)}
              </>
            )}

            {pnlView === "cat" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-category.csv" rows={[["Category", "Qty", "Revenue", "COGS", "Profit", "Margin"],
                    ...catRows.map(a => [a.label, a.qty, Math.round(a.rev), Math.round(a.cogs), a.p, mgn(a.p, a.rev)])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Category</th><th className="num">Qty</th><th className="num">Revenue</th>
                    <th className="num">COGS</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead>
                  <tbody>
                    {catTbl.map((a, i) => (
                      <tr key={i}><td><b>{a.label}</b></td>
                        <td className="num">{a.qty}</td>
                        <td className="num">{inr(a.rev)}</td>
                        <td className="num">{inr(a.cogs)}</td>
                        <td className={"num " + (a.p >= 0 ? "pos" : "neg")}><b>{inr(a.p)}</b></td>
                        <td className="num">{mgn(a.p, a.rev)}</td></tr>))}
                    {!catTbl.length && <tr><td colSpan={6}><div className="empty">No sales in range.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td colSpan={3}>Totals</td>
                    <td className="num">{inr(cogs)}</td><td className="num">{inr(gross)}</td>
                    <td className="num">{mgn(gross, rev)}</td></tr></tfoot>
                </table></div>
                {capNote(catRows.length)}
              </>
            )}

            {pnlView === "brand" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-brand.csv" rows={[["Brand", "Qty", "Revenue", "COGS", "Profit", "Margin"],
                    ...brandRows.map(a => [a.label, a.qty, Math.round(a.rev), Math.round(a.cogs), a.p, mgn(a.p, a.rev)])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Brand</th><th className="num">Qty</th><th className="num">Revenue</th>
                    <th className="num">COGS</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead>
                  <tbody>
                    {brandTbl.map((a, i) => (
                      <tr key={i}><td><b>{a.label}</b></td>
                        <td className="num">{a.qty}</td>
                        <td className="num">{inr(a.rev)}</td>
                        <td className="num">{inr(a.cogs)}</td>
                        <td className={"num " + (a.p >= 0 ? "pos" : "neg")}><b>{inr(a.p)}</b></td>
                        <td className="num">{mgn(a.p, a.rev)}</td></tr>))}
                    {!brandTbl.length && <tr><td colSpan={6}><div className="empty">No sales in range.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td colSpan={3}>Totals</td>
                    <td className="num">{inr(cogs)}</td><td className="num">{inr(gross)}</td>
                    <td className="num">{mgn(gross, rev)}</td></tr></tfoot>
                </table></div>
                {capNote(brandRows.length)}
              </>
            )}

            {pnlView === "cust" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-customer.csv" rows={[["Customer", "Invoices", "Revenue", "COGS", "Profit", "Margin"],
                    ...custRows.map(a => [a.label, a.n, Math.round(a.rev), Math.round(a.cogs), a.p, mgn(a.p, a.rev)])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Customer</th><th className="num">Invoices</th><th className="num">Revenue</th>
                    <th className="num">COGS</th><th className="num">Profit</th><th className="num">Margin</th></tr></thead>
                  <tbody>
                    {custTbl.map((a, i) => (
                      <tr key={i}>
                        <td><b>{a.label}</b> {a.extra ? <span className="chip">{a.extra}</span> : null}</td>
                        <td className="num">{a.n}</td>
                        <td className="num">{inr(a.rev)}</td>
                        <td className="num">{inr(a.cogs)}</td>
                        <td className={"num " + (a.p >= 0 ? "pos" : "neg")}><b>{inr(a.p)}</b></td>
                        <td className="num">{mgn(a.p, a.rev)}</td></tr>))}
                    {!custTbl.length && <tr><td colSpan={6}><div className="empty">No sales in range.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td colSpan={3}>Totals</td>
                    <td className="num">{inr(cogs)}</td><td className="num">{inr(gross)}</td>
                    <td className="num">{mgn(gross, rev)}</td></tr></tfoot>
                </table></div>
                {capNote(custRows.length)}
              </>
            )}

            {pnlView === "sup" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-supplier.csv" rows={[["Supplier", "Bills", "Purchases", "Returns", "Net bought"],
                    ...supRows.map(a => [a.label, a.n, Math.round(a.rev), Math.round(a.cogs), a.net])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Supplier</th><th className="num">Bills</th><th className="num">Purchases</th>
                    <th className="num">Returns</th><th className="num">Net bought</th></tr></thead>
                  <tbody>
                    {supRows.map((a, i) => (
                      <tr key={i}><td><b>{a.label}</b></td>
                        <td className="num">{a.n}</td>
                        <td className="num">{inr(a.rev)}</td>
                        <td className="num">{a.cogs ? "(" + inr(a.cogs) + ")" : ""}</td>
                        <td className="num"><b>{inr(a.net)}</b></td></tr>))}
                    {!supRows.length && <tr><td colSpan={5}><div className="empty">No purchases in range.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td colSpan={4}>Total net bought</td>
                    <td className="num">{inr(supRows.reduce((t, a) => t + a.net, 0))}</td></tr></tfoot>
                </table></div>
              </>
            )}

            {pnlView === "day" && (
              <>
                <div style={{ display: "flex", justifyContent: "flex-end", padding: "8px 16px 0" }}>
                  <CsvBtn name="pnl-by-day.csv" rows={[["Date", "Revenue", "COGS", "Gross", "Expenses", "Net"],
                    ...dayRows.map(a => [a.label, Math.round(a.rev), Math.round(a.cogs),
                      Math.round(a.rev - a.cogs), Math.round(a.ex), Math.round(a.net)])]} />
                </div>
                <div className="tblw" style={{ marginTop: 8 }}><table className="t">
                  <thead><tr><th>Date</th><th className="num">Revenue</th><th className="num">COGS</th>
                    <th className="num">Gross</th><th className="num">Expenses</th><th className="num">Net</th></tr></thead>
                  <tbody>
                    {dayRows.map((a, i) => (
                      <tr key={i}><td><b>{a.label}</b></td>
                        <td className="num">{inr(a.rev)}</td>
                        <td className="num">{inr(a.cogs)}</td>
                        <td className="num">{inr(a.rev - a.cogs)}</td>
                        <td className="num">{a.ex ? "(" + inr(a.ex) + ")" : ""}</td>
                        <td className={"num " + (a.net >= 0 ? "pos" : "neg")}><b>{inr(a.net)}</b></td></tr>))}
                    {!dayRows.length && <tr><td colSpan={6}><div className="empty">No activity in range.</div></td></tr>}
                  </tbody>
                  <tfoot><tr className="tfo"><td>Totals</td>
                    <td className="num">{inr(rev)}</td><td className="num">{inr(cogs)}</td>
                    <td className="num">{inr(gross)}</td><td className="num">({inr(expT)})</td>
                    <td className="num">{inr(np)}</td></tr></tfoot>
                </table></div>
              </>
            )}
          </div>
        );
      })()}
    </>
  );
}