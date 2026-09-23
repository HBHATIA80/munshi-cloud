import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { partyBalance, type Voucher, type Party } from "@/lib/books";
import { CsvBtn } from "@/lib/CsvBtn";
import { ChartsModal } from "@/sections/reports/PnlCharts";
import Link from "next/link";

const TABS = [["stock", "Stock"], ["out", "Outstanding"], ["gst", "GST"], ["pnl", "Profit & Loss"]] as const;
const PNL_VIEWS = [["sum", "Summary"], ["inv", "By Invoice"], ["item", "By Item"], ["cat", "By Category"],
  ["brand", "By Brand"], ["cust", "By Customer"], ["sup", "By Supplier"], ["day", "By Day"]] as const;
const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
const mgn = (p: number, r: number) => (r > 0 ? (p / r * 100).toFixed(1) + "%" : "—");
const TABLE_CAP = 100;          // rows rendered in table; full list always in CSV
const INV_PAGE = 50;            // invoice table page size

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

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; from?: string; to?: string; v?: string; q?: string; pg?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const tab = sp.tab ?? "stock";
  const to = sp.to || new Date().toISOString().slice(0, 10);
  const from = sp.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const pnlView = sp.v ?? "sum";
  const q = (sp.q || "").trim();
  const pg = Math.max(1, +(sp.pg || 1) || 1);

  const sb = await createClient();
  const [{ data: items }, { data: parties }, { data: vs }, { data: expenses },
    { data: cats }, { data: brands }] = await Promise.all([
    sb.from("items").select("*"),
    sb.from("parties").select("*"),
    sb.from("vouchers").select("*"),
    sb.from("expenses").select("head,amount,date").gte("date", from).lte("date", to),
    sb.from("categories").select("id,name"),
    sb.from("brands").select("id,name"),
  ]);
  const V = (vs ?? []) as unknown as Voucher[];
  const Vwin = V.filter(v => v.date >= from && v.date <= to);
  const Vbal = V.filter(v => v.date <= to);
  const P = (parties ?? []) as unknown as Party[];
  const IT = (items ?? []) as any[];
  const EX = (expenses ?? []) as { head: string; amount: number; date: string }[];

  const qlink = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams({ tab, from, to });
    if (tab === "pnl") params.set("v", pnlView);
    if (tab === "pnl" && pnlView === "inv" && q) params.set("q", q);
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === "") params.delete(k); else params.set(k, String(v));
    }
    return `/erp/reports?${params.toString()}`;
  };

  return (
    <>
      <div className="tool">
        {TABS.map(([k, l]) => (
          <Link key={k} className={"fchip" + (tab === k ? " on" : "")}
            href={`/erp/reports?tab=${k}&from=${from}&to=${to}`}>{l}</Link>
        ))}
        <form method="get" style={{ display: "flex", gap: 6 }}>
          <input type="hidden" name="tab" value={tab} />
          {tab === "pnl" && <input type="hidden" name="v" value={pnlView} />}
          <input className="inp mono" type="date" name="from" defaultValue={from} style={{ width: 135 }} />
          <input className="inp mono" type="date" name="to" defaultValue={to} style={{ width: 135 }} />
          <button className="btn sm">Go</button>
        </form>
      </div>

      {tab === "stock" && (() => {
        const I = items ?? [];
        return (
          <div className="panel">
            <div className="ph"><h3>Stock valuation</h3>
              <CsvBtn name="stock.csv" rows={[["Item", "SKU", "Stock", "Cost", "Value"],
                ...I.map(i => [i.name, i.sku, i.stock, i.cost, Math.round(i.stock * i.cost)])]} />
            </div>
            <div className="tblw"><table className="t">
              <thead><tr><th>Item</th><th className="num">Stock</th><th className="num">Cost</th>
                <th className="num">Value</th><th>Status</th></tr></thead>
              <tbody>
                {I.map((i, ix) => (
                  <tr key={ix}>
                    <td><b>{i.name}</b></td>
                    <td className="num">{i.stock}</td>
                    <td className="num">{inr(i.cost)}</td>
                    <td className="num">{inr(i.stock * i.cost)}</td>
                    <td><span className={"chip " + (i.stock <= 0 ? "red" : i.stock <= i.low ? "amb" : "grn")}>
                      {i.stock <= 0 ? "out" : i.stock <= i.low ? "low" : "ok"}</span></td>
                  </tr>))}
                {!I.length && <tr><td colSpan={5}><div className="empty">No items yet.</div></td></tr>}
              </tbody>
              <tfoot><tr className="tfo"><td colSpan={3}>Total at cost</td>
                <td className="num">{inr(I.reduce((t, i) => t + i.stock * i.cost, 0))}</td><td /></tr></tfoot>
            </table></div>
          </div>
        );
      })()}

      {tab === "out" && (() => {
        const rows = P.map(p => ({ p, b: partyBalance(Vbal, p) })).filter(r => Math.abs(r.b) >= .01);
        const totThey = Math.round(rows.reduce((t, r) => t + Math.max(r.b, 0), 0) * 100) / 100;
        const totWe = Math.round(rows.reduce((t, r) => t + Math.max(-r.b, 0), 0) * 100) / 100;
        const net = Math.round((totThey - totWe) * 100) / 100;
        const health = net > 0.5
          ? { cls: "grn", tag: "HEALTHY", msg: "Receivables exceed payables — more money is coming to you than going out." }
          : net < -0.5
          ? { cls: "red", tag: "STRAINED", msg: "Payables exceed receivables — you owe suppliers more than customers owe you. Collect faster or slow payments." }
          : { cls: "", tag: "BALANCED", msg: "Receivables and payables are roughly equal." };
        return (
          <div className="panel">
            <div className="ph"><h3>Who owes what</h3>
              <CsvBtn name="outstanding.csv" rows={[
                ["Party", "Type", "They owe", "We owe"],
                ...rows.map(r => [r.p.name, r.p.type, r.b > 0 ? Math.round(r.b) : "", r.b < 0 ? Math.round(-r.b) : ""]),
                ["", "", "", ""],
                ["TOTAL", "", Math.round(totThey), Math.round(totWe)],
                ["NET (They − We)", "", Math.round(net), ""],
              ]} />
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap",
              padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              <div style={{ flex: "1 1 160px" }}>
                <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>They owe us</div>
                <b style={{ font: "600 22px var(--font-disp)", color: "var(--green, #1a7f37)" }}>{inr(totThey)}</b>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>We owe</div>
                <b style={{ font: "600 22px var(--font-disp)", color: "var(--red, #c62828)" }}>{inr(totWe)}</b>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Net position (they − we)</div>
                <b style={{ font: "600 22px var(--font-disp)",
                  color: net >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)" }}>
                  {net >= 0 ? "+" : "−"}{inr(Math.abs(net))}</b>
              </div>
              <div style={{ flex: "2 1 260px", display: "flex", flexDirection: "column",
                justifyContent: "center", gap: 4 }}>
                <span className={"chip " + health.cls} style={{ alignSelf: "flex-start" }}>{health.tag}</span>
                <span className="mut" style={{ fontSize: 12 }}>{health.msg}</span>
              </div>
            </div>
            <div className="tblw"><table className="t">
              <thead><tr><th>Party</th><th>Type</th><th className="num">They owe</th><th className="num">We owe</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td><b>{r.p.name}</b></td>
                    <td><span className="chip">{r.p.type}</span></td>
                    <td className="num neg">{r.b > 0 ? inr(r.b) : ""}</td>
                    <td className="num">{r.b < 0 ? inr(-r.b) : ""}</td>
                  </tr>))}
                {!rows.length && <tr><td colSpan={4}><div className="empty">All settled.</div></td></tr>}
              </tbody>
              <tfoot>
                <tr className="tfo"><td colSpan={2}>Totals</td>
                  <td className="num">{inr(totThey)}</td><td className="num">{inr(totWe)}</td></tr>
                <tr className="tfo"><td colSpan={2}>Net (they owe − we owe)</td>
                  <td className="num" colSpan={2}>{net >= 0 ? "+" : "−"}{inr(Math.abs(net))}</td></tr>
              </tfoot>
            </table></div>
            <p className="mut" style={{ fontSize: 11.5, padding: "8px 12px 12px" }}>
              Lifetime balances as of {to} (opening balance + all vouchers, including party journals).
              A supplier under “They owe” means their account is in debit — check their Party Ledger.
            </p>
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
            <div className="ph"><h3>GST summary</h3>
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

      {tab === "pnl" && (() => {
        const nameOf = (id: unknown) => P.find(x => x.id === id)?.name ?? "Counter / Cash";
        const catName = new Map<string, string>((cats ?? []).map((c: any) => [String(c.id), c.name]));
        const brandName = new Map<string, string>((brands ?? []).map((b: any) => [String(b.id), b.name]));
        const catLabelOf = (it: any) => {
          const c = catName.get(String(it?.cat_id ?? "")) ?? "Uncategorised";
          const s = it?.sub_id ? catName.get(String(it.sub_id)) : null;
          return s && s !== c ? `${c} › ${s}` : c;
        };
        const catById = new Map<string, string>();
        const brandById = new Map<string, string>();
        IT.forEach(i => {
          catById.set(i.id, catLabelOf(i));
          brandById.set(i.id, brandName.get(String(i?.brand_id ?? "")) ?? "Unbranded");
        });

        const lineNetRaw = (l: any) =>
          l._net != null ? +l._net : Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;

        const mItem = new Map<string, Agg>();
        const mCat = new Map<string, Agg>();
        const mBrand = new Map<string, Agg>();
        const mCust = new Map<string, Agg>();
        const mDay = new Map<string, Agg>();
        const mSup = new Map<string, Agg>();
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
              cogs: Math.round(vCost * sign * 100) / 100 });
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

        /* chart data (serializable → modal) */
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

        /* invoice view: search + pagination (scales to thousands) */
        const ql = q.toLowerCase();
        const invFiltered = ql
          ? invRows.filter(r => (r.no + " " + r.party).toLowerCase().includes(ql))
          : invRows;
        const invPages = Math.max(1, Math.ceil(invFiltered.length / INV_PAGE));
        const pgCur = Math.min(pg, invPages);
        const invPage = invFiltered.slice((pgCur - 1) * INV_PAGE, pgCur * INV_PAGE);

        /* caps for dimension tables */
        const capNote = (n: number) => n > TABLE_CAP
          ? <p className="mut" style={{ fontSize: 11.5, padding: "6px 12px" }}>
              Showing top {TABLE_CAP} by profit of {n.toLocaleString("en-IN")} — the full list is in the CSV.</p>
          : null;
        const itemTbl = itemRows.slice(0, TABLE_CAP);
        const catTbl = catRows.slice(0, TABLE_CAP);
        const brandTbl = brandRows.slice(0, TABLE_CAP);
        const custTbl = custRows.slice(0, TABLE_CAP);

        return (
          <div className="panel">
            <div className="ph">
              <h3>Profit &amp; Loss</h3>
              <span className="mut" style={{ fontSize: 12 }}>{from} → {to}</span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "10px 16px 0" }}>
              {PNL_VIEWS.map(([k, l]) => (
                <Link key={k} className={"fchip" + (pnlView === k ? " on" : "")}
                  href={`/erp/reports?tab=pnl&v=${k}&from=${from}&to=${to}`}>{l}</Link>
              ))}
              <span style={{ flex: 1 }} />
              <ChartsModal view={pnlView} daily={chartDaily} items={chartItems} cats={chartCats}
                brands={chartBrands} custs={chartCust} sups={chartSup} invs={chartInv} />
            </div>

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
                  GST excluded. Bill discounts allocated proportionally to lines, so every dimension view
                  reconciles to Gross profit. Click 📈 Charts above for trend lines.
                </p>
              </div>
            )}

            {pnlView === "inv" && (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center",
                  flexWrap: "wrap", padding: "10px 16px 0" }}>
                  <form method="get" style={{ display: "flex", gap: 6 }}>
                    <input type="hidden" name="tab" value="pnl" />
                    <input type="hidden" name="v" value="inv" />
                    <input type="hidden" name="from" value={from} />
                    <input type="hidden" name="to" value={to} />
                    <input className="inp" name="q" defaultValue={q} placeholder="Search invoice no / party…"
                      style={{ maxWidth: 230 }} />
                    <button className="btn sm">Search</button>
                    {q && <Link className="btn sm" href={qlink({ q: undefined, pg: undefined })}>✕</Link>}
                  </form>
                  <span className="mut" style={{ fontSize: 12 }}>
                    {invFiltered.length.toLocaleString("en-IN")} document{invFiltered.length === 1 ? "" : "s"}
                  </span>
                  <span style={{ flex: 1 }} />
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
                      aria-disabled={pgCur <= 1}
                      href={qlink({ pg: pgCur > 1 ? pgCur - 1 : undefined })}>← Prev</Link>
                    <span className="mut" style={{ fontSize: 12 }}>Page {pgCur} / {invPages}</span>
                    <Link className={"btn sm" + (pgCur >= invPages ? " dis" : "")}
                      aria-disabled={pgCur >= invPages}
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