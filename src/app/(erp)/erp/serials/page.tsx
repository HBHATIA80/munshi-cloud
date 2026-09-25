import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function SerialLookupPage({ searchParams }:
  { searchParams: Promise<{ q?: string }> }) {
  await requireStaff();
  const { q } = await searchParams;
  const term = (q || "").trim();
  const sb = await createClient();

  let rows: any[] = [];
  if (term) {
    const { data } = await sb.from("item_serials")
      .select("serial,status,item_id,sale_voucher,created_at")
      .ilike("serial", `%${term}%`)
      .limit(50);
    rows = data ?? [];
    const ids = [...new Set(rows.map(r => r.item_id))];
    if (ids.length) {
      const { data: its } = await sb.from("items").select("id,name").in("id", ids);
      const m = new Map((its ?? []).map((i: any) => [i.id, i.name]));
      rows = rows.map(r => ({ ...r, item: m.get(r.item_id) ?? "—" }));
    }
  }

  return (
    <>
      <div className="ph" style={{ marginBottom: 10 }}>
        <h2>Serial number lookup</h2>
        <p className="mut" style={{ fontSize: 12 }}>
          Enter a serial (or part of it) to see its status and which invoice sold it —
          for warranty claims and IMEI checks.</p>
      </div>

      <form method="get" className="tool" style={{ marginBottom: 14 }}>
        <input className="inp mono" name="q" defaultValue={term}
          placeholder="Type or scan a serial number…" style={{ maxWidth: 320 }} autoFocus />
        <button className="btn pri sm">Search</button>
      </form>

      {term && (
        <div className="panel"><div className="tblw"><table className="t">
          <thead><tr><th>Serial</th><th>Item</th><th>Status</th><th>Sold on</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td className="mono"><b>{r.serial}</b></td>
                <td>{r.item}</td>
                <td><span className={"chip " + (r.status === "in_stock" ? "grn" : "amb")}>
                  {r.status === "in_stock" ? "in stock" : "sold"}</span></td>
                <td className="mono">
                  {r.sale_voucher ?? "—"}
                </td>
              </tr>))}
            {!rows.length && <tr><td colSpan={4}><div className="empty">
              No serials match “{term}”.</div></td></tr>}
          </tbody>
        </table></div></div>)}

      {!term && <div className="empty">Search above — results show stock status and the selling invoice.</div>}
    </>
  );
}