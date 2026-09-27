import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function PriceIntelPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: items }, { data: parties }] = await Promise.all([
    sb.from("items").select("id,name,sku,cost").order("name"),
    sb.from("parties").select("id,name"),
  ]);
  const supMap = new Map((parties ?? []).map((p: any) => [p.id, p.name]));

  // last 5 purchase lines per item, from the most recent 300 purchase bills
  const { data: ps } = await sb.from("vouchers")
    .select("no,date,party_id,lines")
    .eq("type", "purchase")
    .order("date", { ascending: false })
    .limit(300);
  const byItem: Record<string, { no: string; date: string; qty: number; rate: number; supplier: string }[]> = {};
  for (const v of (ps ?? []) as any[]) {
    for (const l of (v.lines ?? []) as any[]) {
      if (!l.item_id) continue;
      const arr = byItem[l.item_id] ?? (byItem[l.item_id] = []);
      if (arr.length >= 5) continue;
      arr.push({ no: v.no, date: v.date, qty: +l.qty, rate: +l.rate,
        supplier: supMap.get(v.party_id) ?? "Cash" });
    }
  }

  return (
    <>
      <div className="ph" style={{ marginBottom: 10 }}>
        <h2>Purchase price comparison</h2>
        <p className="mut" style={{ fontSize: 12 }}>
          Last 5 purchase bills per item — spot cost drift and verify supplier rates.</p>
      </div>
      <PriceTable items={(items ?? []) as any} byItem={byItem} />
    </>
  );
}

function PriceTable({ items, byItem }: {
  items: { id: string; name: string; sku: string; cost: number }[];
  byItem: Record<string, { no: string; date: string; qty: number; rate: number; supplier: string }[]>;
}) {
  const rows = items
    .map(i => ({ ...i, list: byItem[i.id] ?? [] }))
    .filter(r => r.list.length > 0)
    .sort((a, b) => (b.list[0]?.date ?? "").localeCompare(a.list[0]?.date ?? ""));
  const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
  return (
    <div className="panel"><div className="tblw"><table className="t">
      <thead><tr>
        <th>Item</th><th className="num">Master cost</th><th className="num">Last bought</th>
        <th>Supplier</th><th>Bill</th><th>Date</th><th>Range (last 5)</th></tr></thead>
      <tbody>
        {rows.map(r => {
          const last = r.list[0];
          const min = Math.min(...r.list.map(p => p.rate));
          const max = Math.max(...r.list.map(p => p.rate));
          const drift = last && r.cost && last.rate !== r.cost;
          return (
            <tr key={r.id}>
              <td><b>{r.name}</b> <span className="mut mono" style={{ fontSize: 10.5 }}>{r.sku}</span></td>
              <td className="num">{inr(r.cost)}</td>
              <td className="num"><b>{inr(last.rate)}</b>
                {last.qty > 1 && <span className="mut" style={{ fontSize: 10.5 }}> ×{last.qty}</span>}</td>
              <td>{last.supplier}</td>
              <td className="mono" style={{ fontSize: 11 }}>{last.no}</td>
              <td style={{ fontSize: 11.5 }}>{last.date}</td>
              <td className="num" style={{ fontSize: 11.5 }}>
                {min === max ? inr(min) : `${inr(min)} – ${inr(max)}`}
                {drift && <span className="chip amb" style={{ marginLeft: 6 }}
                  title="Master cost differs from the latest bill">drift</span>}
              </td>
            </tr>);
        })}
        {!rows.length && <tr><td colSpan={7}><div className="empty">
          No purchase history yet — it fills in as bills are posted.</div></td></tr>}
      </tbody>
    </table></div></div>
  );
}