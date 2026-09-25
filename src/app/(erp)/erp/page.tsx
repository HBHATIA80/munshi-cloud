import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { partyBalance, type Voucher, type Party } from "@/lib/books";
import { fmt0 } from "@/lib/format";
import { DashRecent } from "@/sections/invoicing/DashRecent";

export default async function ErpDash() {
  const s = await requireStaff();
  const sb = await createClient();
  const m = new Date().toISOString().slice(0, 7);
  const [{ data: vs }, { data: items }, { data: parties }, { data: orders }] = await Promise.all([
    sb.from("vouchers").select("*").order("date", { ascending: false }).limit(400),
    sb.from("items").select("name,stock,low"),
    sb.from("parties").select("*"),
    sb.from("orders").select("total,status").eq("status", "placed"),
  ]);
  const V = (vs ?? []) as unknown as Voucher[];
  const P = (parties ?? []) as unknown as Party[];
  const ms = V.filter(v => v.type === "sale" && v.date.slice(0, 7) === m);
  const rev = ms.reduce((t, v) => t + +v.taxable, 0);
  const cogs = ms.reduce((t, v) => t + (v.lines ?? []).reduce((t2, l) => t2 + (l.cost ?? 0) * l.qty, 0), 0);
  const recv = P.filter(p => p.type !== "supplier").reduce((t, p) => t + Math.max(partyBalance(V, p), 0), 0);
  const pay = P.filter(p => p.type === "supplier").reduce((t, p) => t + Math.max(-partyBalance(V, p), 0), 0);
  const lows = (items ?? []).filter(i => i.stock <= i.low);
  const recent = V.slice(0, 8);
  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="l">Sales this month</div><div className="v">{fmt0(rev)}</div>
          <div className="s">{ms.length} invoices</div></div>
        <div className="kpi"><div className="l">Gross profit</div>
          <div className="v pos">{fmt0(Math.round(rev - cogs))}</div><div className="s">month to date</div></div>
          <div className="kpi"><div className="l">Receivables</div><div className="v pos">{fmt0(Math.round(recv))}</div>
          <div className="s">to collect</div></div>
        <div className="kpi"><div className="l">Payables</div><div className="v neg">{fmt0(Math.round(pay))}</div>
          <div className="s">to suppliers</div></div>      <div className="kpi"><div className="l">Website orders</div><div className="v">{orders?.length ?? 0}</div>
          <div className="s">awaiting confirmation</div></div>
        <div className="kpi"><div className="l">Low stock</div>
          <div className="v" style={{ color: lows.length ? "var(--amber)" : "inherit" }}>{lows.length}</div>
          <div className="s">items</div></div>
      </div>
      <div className="grid2">
        <div className="panel">
          <div className="ph"><h3>Recent vouchers</h3>
            <a className="btn sm" href="/erp/daybook">Day Book</a></div>
          <div className="tblw">
            <table className="t">
              <thead>
                <tr><th>Date</th><th>Voucher</th><th>Party</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                <DashRecent recent={recent} parties={P} />
              </tbody>
            </table>
          </div>
          <p className="mut" style={{ fontSize: 11, padding: "8px 16px" }}>
            Open the Day Book to view or edit any voucher in full.</p>
        </div>
        <div className="stack">
          <div className="panel">
            <div className="ph"><h3>Quick post</h3></div>
            <div className="pb" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <a className="btn pri" href="/erp/sale">＋ Invoice</a>
              <a className="btn" href="/erp/purch">＋ Purchase</a>
              <a className="btn" href="/erp/rcpt">↙ Receipt</a>
              <a className="btn" href="/erp/pay">↗ Payment</a>
            </div>
          </div>
          <div className="panel">
            <div className="ph"><h3>Low stock</h3></div>
            <div className="tblw">
              <table className="t">
                <tbody>
                  {lows.slice(0, 6).map((i, ix) => (
                    <tr key={ix}>
                      <td><b>{i.name}</b></td>
                      <td className="num neg">{i.stock} left</td>
                    </tr>
                  ))}
                  {!lows.length && (
                    <tr><td style={{ padding: 16 }} className="mut">All items healthy</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}