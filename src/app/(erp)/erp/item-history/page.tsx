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
  const cq = (sp.cq || "").trim();          // customer filter for the sales table

  const sb = await createClient();
  const [{ data: items }, { data: parties }] = await Promise.all([
    sb.from("items").select("id,name,sku,unit,cost,pr,ps,stock,has_serial")
      .eq("tenant_id", s.tenantId).order("name"),
    sb.from("parties").select("id,name").eq("tenant_id", s.tenantId),
  ]);
  const P = new Map((parties ?? []).map((p: any) => [p.id, p.name]));
  const item = (items ?? []).find((i: any) => i.id === itemId);

  // ── full-detail trail: newest first, ALL line fields ──
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

    // sales searchable by customer name (totals above stay complete — filter only trims the view)
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

  // tiny inline CSV (avoids importing CsvBtn client comp on a server page)
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

  return (
    <>
      <div className="ph" style={{ marginBottom: 10 }}>
        <h2>Item history — purchase &amp; sales trail</h2>
        <p className="mut" style={{ fontSize: 12 }}>
          Full line-level detail per document: rate, discount, GST, totals, serials.
          Search an item, choose how many entries to see.</p>
      </div>

      {/* picker (shows NAME, never uuid) + filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap",
        alignItems: "center", marginBottom: 14 }}>
        <ItemHistoryPicker items={(items ?? []) as any} itemId={itemId}
          nLimit={nLimit} view={view} />
        <form method="get" action="/erp/item-history" style={{ display: "flex",
          gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="item" value={itemId} />
          <label className="mut" style={{ fontSize: 12 }}>Entries</label>
          <select className="inp mono" name="n" defaultValue={String(nLimit)} style={{ width: 90 }}>
            {[5, 10, 20, 50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <select className="inp" name="view" defaultValue={view} style={{ width: 130 }}>
            <option value="both">Both</option>
            <option value="purch">Purchases only</option>
            <option value="sales">Sales only</option>
          </select>
          {view !== "purch" && (
            <input className="inp" name="cq" defaultValue={cq}
              placeholder="Filter sales by customer…" style={{ maxWidth: 200 }} />)}
          <button className="btn pri sm" type="submit">Show history</button>
        </form>
      </div>

      {!itemId && <div className="empty">Search an item above to load its full purchase &amp; sales history.</div>}

      {item && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="ph"><h3>{item.name}</h3>
            <div className="mut" style={{ fontSize: 12 }}>
              {item.sku ? `SKU ${item.sku} · ` : ""}unit {item.unit ?? "pc"} · stock <b>{item.stock ?? 0}</b></div></div>
          <div className="pb" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 140px" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Last purchase</div>
              <b style={{ fontSize: 16 }}>{lastPu ? inr(lastPu.rate) : "—"}</b>
              {lastPu && <div className="mut" style={{ fontSize: 11 }}>{lastPu.party} · {lastPu.date}</div>}
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Last sold</div>
              <b style={{ fontSize: 16 }}>{lastSale ? inr(lastSale.rate) : "—"}</b>
              {lastSale && <div className="mut" style={{ fontSize: 11 }}>{lastSale.party} · {lastSale.date}</div>}
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Implied margin</div>
              {margin !== null
                ? <b style={{ fontSize: 16, color: margin >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)" }}>
                    {inr(margin)}</b>
                : <b style={{ fontSize: 16 }}>—</b>}
              <div className="mut" style={{ fontSize: 11 }}>last buy vs last sale</div>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Qty purchased</div>
              <b style={{ fontSize: 16 }}>{qtyPurchased}</b>
              <div className="mut" style={{ fontSize: 11 }}>spent {inr(spentP)}</div>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Qty sold</div>
              <b style={{ fontSize: 16 }}>{qtySold}</b>
              <div className="mut" style={{ fontSize: 11 }}>earned {inr(earnedS)}</div>
            </div>
            <div style={{ flex: "1 1 140px" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase" }}>Master cost</div>
              <b style={{ fontSize: 16 }}>{inr(item.cost)}</b>
              {lastPu && item.cost !== lastPu.rate &&
                <span className="chip amb" style={{ marginLeft: 6 }}>drift</span>}
            </div>
          </div>
        </div>)}

      {item && view !== "sales" && <div style={{ marginBottom: 14 }}><LineTable rows={purch} kind="purchase" /></div>}
      {item && view !== "purch" && <LineTable rows={sales} kind="sale" />}

      <p className="mut" style={{ fontSize: 11.5, marginTop: 8 }}>
        Deeper trail? Open <Link href={`/erp/reports?tab=mv&item=${itemId}&n=${nLimit}`}
        style={{ color: "var(--brand)" }}>Item Movement in Reports</Link> for the summary view,
        or the <Link href="/erp/serials" style={{ color: "var(--brand)" }}>Serial Lookup</Link> for individual units.</p>
    </>
  );
}