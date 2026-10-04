import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ItemHistoryPicker } from "@/sections/catalog/ItemHistoryPicker";

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

export default async function ItemHistoryPage({ searchParams }: {
  searchParams: Promise<{ item?: string; n?: string; view?: string; cq?: string }> }) {
  const s = await requireStaff();
  const sp = await searchParams;
  const itemId = sp.item || "";
  const nLimit = Math.min(200, Math.max(1, +(sp.n || 10) || 10));
  const view = sp.view === "sales" ? "sales" : sp.view === "purch" ? "purch" : "both";
  const cq = (sp.cq || "").trim();

  const sb = await createClient();
  const [{ data: items }, { data: parties }] = await Promise.all([
    sb.from("items").select("id,name,sku,unit,cost,pr,ps,stock,has_serial")
      .eq("tenant_id", s.tenantId).order("name"),
    sb.from("parties").select("id,name").eq("tenant_id", s.tenantId),
  ]);
  const P = new Map((parties ?? []).map((p: any) => [p.id, p.name]));
  const item = (items ?? []).find((i: any) => i.id === itemId);

  type LineRec = {
    no: string; date: string; party: string; type: string;
    qty: number; rate: number; disc: number; gst: number; total: number;
    serials: string[];
  };
  const purch: LineRec[] = [];
  let sales: LineRec[] = [];
  let qtyPurchased = 0, qtySold = 0, spentP = 0, earnedS = 0;

  if (itemId) {
    const { data: vs } = await sb.from("vouchers")
      .select("no,date,type,party_id,lines")
      .eq("tenant_id", s.tenantId)
      .in("type", ["purchase", "sale", "salret"])
      .order("date", { ascending: false })
      .limit(2000);
    for (const v of (vs ?? []) as any[]) {
      for (const l of (v.lines ?? []) as any[]) {
        if (l.item_id !== itemId) continue;
        const net = l._net != null ? +l._net
          : Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;
        const rec: LineRec = {
          no: v.no, date: v.date,
          party: P.get(v.party_id) ?? (v.type === "purchase" ? "Cash" : "Counter"),
          type: v.type, qty: +l.qty, rate: +l.rate, disc: +(l.disc || 0),
          gst: +(l.gst || 0), total: Math.round((net + (net * (l.gst || 0) / 100)) * 100) / 100,
          serials: (l.serials as string[] | undefined) ?? [],
        };
        if (v.type === "purchase") {
          if (purch.length < nLimit) { purch.push(rec); qtyPurchased += rec.qty; spentP += rec.qty * rec.rate; }
        } else {
          if (sales.length < nLimit) {
            sales.push(rec);
            if (v.type === "sale") { qtySold += rec.qty; earnedS += rec.qty * rec.rate; }
            else { qtySold -= rec.qty; earnedS -= rec.qty * rec.rate; }
          }
        }
      }
    }
    const cql = cq.toLowerCase();
    if (cql) sales = sales.filter(r => r.party.toLowerCase().includes(cql));
  }

  const lastPu = purch[0] ?? null;
  const lastSale = sales.find(x => x.type === "sale") ?? null;
  const margin = lastPu && lastSale ? Math.round((lastSale.rate - lastPu.rate) * 100) / 100 : null;

  const headCell: React.CSSProperties = { padding: "6px 8px", fontSize: 11 };
  const cell: React.CSSProperties = { padding: "5px 8px", fontSize: 12 };

  const LineTable = ({ rows, kind }: { rows: LineRec[]; kind: "purchase" | "sale" }) => (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 8 }}>
        <b style={{ fontSize: 13.5 }}>
          {kind === "purchase" ? "🛒 Purchase history" : "🧾 Sales history"}
          <span className="mut" style={{ fontWeight: 400, fontSize: 11.5, marginLeft: 6 }}>
            ({rows.length} shown{kind === "sale" && cq ? ` · filtered by “${cq}”` : ""})
          </span>
        </b>
        <CsvBtnLite name={`item-${kind}-history.csv`} rows={rows} kind={kind} />
      </div>
      <div className="tblw"><table className="t">
        <thead><tr>
          <th style={headCell}>Doc</th><th style={headCell}>Date</th>
          <th style={headCell}>{kind === "purchase" ? "Supplier" : "Customer"}</th>
          <th className="num" style={headCell}>Qty</th>
          <th className="num" style={headCell}>Rate</th>
          <th className="num" style={headCell}>Disc%</th>
          <th className="num" style={headCell}>GST%</th>
          <th className="num" style={headCell}>Line total</th>
        </tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.no + i}>
              <td style={{ ...cell, whiteSpace: "nowrap" }}>
                <b className="mono">{r.no}</b>
                {r.type === "salret" && <span className="chip red" style={{ fontSize: 9, marginLeft: 4 }}>ret</span>}
                {i === 0 && kind === "purchase" && <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
                {i === 0 && kind === "sale" && r.type === "sale" && <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
              </td>
              <td style={cell}>{r.date}</td>
              <td style={cell}>{r.party}</td>
              <td className="num" style={cell}>{r.type === "salret" ? `−${r.qty}` : r.qty}</td>
              <td className="num" style={{ ...cell, fontWeight: 700 }}>{inr(r.rate)}</td>
              <td className="num" style={cell}>{r.disc ? r.disc + "%" : "—"}</td>
              <td className="num" style={cell}>{r.gst ? r.gst + "%" : "—"}</td>
              <td className="num" style={{ ...cell, fontWeight: 700 }}>{inr(r.total)}</td>
            </tr>))}
          {rows.map((r, i) => r.serials.length > 0 ? (
            <tr key={"s" + i} style={{ background: "var(--card2, #f7f3e6)" }}>
              <td /><td colSpan={7} style={{ ...cell, fontSize: 11 }} className="mut">
                S/N: {r.serials.join(", ")}</td>
            </tr>) : null)}
          {!rows.length && <tr><td colSpan={8}><div className="empty">
            {kind === "sale" && cq
              ? `No sales to “${cq}” in the latest ${nLimit}.`
              : `No ${kind === "purchase" ? "purchases" : "sales"} recorded for this item.`}</div></td></tr>}
        </tbody>
      </table></div>
    </div>
  );

  function CsvBtnLite({ name, rows, kind }: { name: string; rows: LineRec[]; kind: string }) {
    const header = kind === "purchase"
      ? ["Bill", "Date", "Supplier", "Qty", "Rate", "Disc%", "GST%", "Line total", "Serials"]
      : ["Invoice", "Date", "Customer", "Qty", "Rate", "Disc%", "GST%", "Line total", "Serials"];
    const body = rows.map(r => [r.no, r.date, r.party, r.qty, r.rate, r.disc, r.gst,
      r.total, r.serials.join(" ")]);
    const csv = [header, ...body].map(r => r.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
    return (
      <a className="btn sm" download={name}
        href={"data:text/csv;charset=utf-8,\uFEFF" + encodeURIComponent(csv)}>⭳ CSV</a>
    );
  }

  const Stat = ({ label, value, sub, color }: {
    label: string; value: string; sub?: string; color?: string }) => (
    <div style={{ flex: "1 1 130px", border: "1px solid var(--line)", borderRadius: 10,
      padding: "10px 12px" }}>
      <div className="mut" style={{ fontSize: 10, textTransform: "uppercase",
        letterSpacing: ".08em" }}>{label}</div>
      <b style={{ fontSize: 17, color }}>{value}</b>
      {sub && <div className="mut" style={{ fontSize: 11 }}>{sub}</div>}
    </div>);

  return (
    <>
      <div style={{ maxWidth: 900, margin: "0 auto 6px" }}>
        <h2 style={{ margin: "0 0 2px" }}>Item history</h2>
        <p className="mut" style={{ fontSize: 13, margin: "0 0 14px" }}>
          Pick an item — see every purchase and sale, with rates, discounts, GST and serials.</p>

        {/* ── hero picker row ── */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 420px" }}>
            <ItemHistoryPicker items={(items ?? []) as any} itemId={itemId}
              nLimit={nLimit} view={view} />
          </div>
          <form method="get" action="/erp/item-history" style={{ display: "flex",
            gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input type="hidden" name="item" value={itemId} />
            <div>
              <label className="fl" style={{ fontSize: 11 }}>Entries</label>
              <select className="inp mono" name="n" defaultValue={String(nLimit)} style={{ width: 92 }}>
                {[5, 10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="fl" style={{ fontSize: 11 }}>Show</label>
              <select className="inp" name="view" defaultValue={view} style={{ width: 120 }}>
                <option value="both">Both</option>
                <option value="purch">Purchases</option>
                <option value="sales">Sales</option>
              </select>
            </div>
            <button className="btn pri" type="submit"
              style={{ padding: "10px 18px", fontSize: 14 }}>Show history</button>
          </form>
        </div>
      </div>

      {!itemId && (
        <div className="empty" style={{ maxWidth: 900, margin: "0 auto" }}>
          🔍 Search an item above — its complete purchase &amp; sales history appears here.</div>)}

      {item && (
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          {/* ── summary strip ── */}
          <div className="panel" style={{ marginBottom: 14, padding: 14 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Stat label="Item" value={item.name} sub={item.sku ? `SKU ${item.sku}` : undefined} />
              <Stat label="Last purchase" value={lastPu ? inr(lastPu.rate) : "—"}
                sub={lastPu ? `${lastPu.party} · ${lastPu.date}` : undefined} />
              <Stat label="Last sold" value={lastSale ? inr(lastSale.rate) : "—"}
                sub={lastSale ? `${lastSale.party} · ${lastSale.date}` : undefined} />
              <Stat label="Implied margin"
                value={margin !== null ? inr(margin) : "—"}
                sub="last buy vs last sale"
                color={margin != null
                  ? (margin >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)")
                  : undefined} />
              <Stat label="Qty bought / sold"
                value={`${qtyPurchased} / ${qtySold}`}
                sub={`spent ${inr(spentP)} · earned ${inr(earnedS)}`} />
              <Stat label="Stock now" value={String(item.stock ?? 0)}
                sub={`master cost ${inr(item.cost)}${lastPu && item.cost !== lastPu.rate ? " · drift" : ""}`}
                color={(item.stock ?? 0) <= 0 ? "var(--red, #c62828)" : undefined} />
            </div>
          </div>

          {/* ── purchases ── */}
          {view !== "sales" && <div style={{ marginBottom: 14 }}><LineTable rows={purch} kind="purchase" /></div>}

          {/* ── sales — with customer filter INSIDE the section ── */}
          {view !== "purch" && (
            <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <b style={{ fontSize: 13.5 }}>🧾 Sales history
                  <span className="mut" style={{ fontWeight: 400, fontSize: 11.5, marginLeft: 6 }}>
                    ({sales.length} shown{cq ? ` · filtered by “${cq}”` : ""})
                  </span>
                </b>
                <CsvBtnLite name="item-sales-history.csv" rows={sales} kind="sale" />
              </div>

              {/* customer filter — lives in the sales section */}
              <form method="get" action="/erp/item-history" style={{ display: "flex",
                gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <input type="hidden" name="item" value={itemId} />
                <input type="hidden" name="n" value={String(nLimit)} />
                <input type="hidden" name="view" value={view} />
                <input className="inp" name="cq" defaultValue={cq}
                  placeholder="🔍  Search customer name — who bought this item…"
                  style={{ flex: "1 1 320px", fontSize: 14.5, padding: "10px 14px",
                    borderRadius: 10 }} />
                <button className="btn pri" type="submit"
                  style={{ padding: "10px 18px" }}>Search</button>
                {cq && <Link className="btn" href={`/erp/item-history?item=${itemId}&n=${nLimit}&view=${view}`}>✕ Clear</Link>}
              </form>

              <div className="tblw"><table className="t">
                <thead><tr>
                  <th style={headCell}>Invoice</th><th style={headCell}>Date</th>
                  <th style={headCell}>Customer</th>
                  <th className="num" style={headCell}>Qty</th>
                  <th className="num" style={headCell}>Rate</th>
                  <th className="num" style={headCell}>Disc%</th>
                  <th className="num" style={headCell}>GST%</th>
                  <th className="num" style={headCell}>Line total</th>
                </tr></thead>
                <tbody>
                  {sales.map((r, i) => (
                    <tr key={r.no + i}>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>
                        <b className="mono">{r.no}</b>
                        {r.type === "salret" && <span className="chip red" style={{ fontSize: 9, marginLeft: 4 }}>ret</span>}
                        {i === 0 && r.type === "sale" && <span className="chip grn" style={{ fontSize: 9, marginLeft: 4 }}>last</span>}
                      </td>
                      <td style={cell}>{r.date}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>{r.party}</td>
                      <td className="num" style={cell}>{r.type === "salret" ? `−${r.qty}` : r.qty}</td>
                      <td className="num" style={{ ...cell, fontWeight: 700 }}>{inr(r.rate)}</td>
                      <td className="num" style={cell}>{r.disc ? r.disc + "%" : "—"}</td>
                      <td className="num" style={cell}>{r.gst ? r.gst + "%" : "—"}</td>
                      <td className="num" style={{ ...cell, fontWeight: 700 }}>{inr(r.total)}</td>
                    </tr>))}
                  {sales.map((r, i) => r.serials.length > 0 ? (
                    <tr key={"s" + i} style={{ background: "var(--card2, #f7f3e6)" }}>
                      <td /><td colSpan={7} style={{ ...cell, fontSize: 11 }} className="mut">
                        S/N: {r.serials.join(", ")}</td>
                    </tr>) : null)}
                  {!sales.length && <tr><td colSpan={8}><div className="empty">
                    {cq ? `No sales to “${cq}” in the latest ${nLimit}.`
                      : "No sales recorded for this item."}</div></td></tr>}
                </tbody>
              </table></div>
            </div>)}

          <p className="mut" style={{ fontSize: 11.5, marginTop: 10 }}>
            Summary view: <Link href={`/erp/reports?tab=mv&item=${itemId}&n=${nLimit}`}
              style={{ color: "var(--brand)" }}>Item Movement in Reports</Link>
            {" · "}Individual units: <Link href="/erp/serials"
              style={{ color: "var(--brand)" }}>Serial Lookup</Link></p>
        </div>)}
    </>
  );
}