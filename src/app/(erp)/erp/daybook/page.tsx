import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dmy } from "@/lib/format";

type V = { id: string; no: string; type: string; party_id: string | null;
  mode: string; total: number };
type Row = { key: string; no: string; type: string; party: string;
  mode: string; total: number; warn?: boolean };

export default async function DayBookPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  await requireStaff();
  const { d } = await searchParams;
  const date = d || new Date().toISOString().slice(0, 10);
  const sb = await createClient();
  const [{ data: vs }, { data: ps }] = await Promise.all([
    sb.from("vouchers").select("*").eq("date", date).order("created_at"),
    sb.from("parties").select("id,name"),
  ]);
  const nameOf = (id: unknown) =>
    (ps ?? []).find(p => p.id === id)?.name ?? "—";
  const V = (vs ?? []) as unknown as V[];

  // One transaction = one row. Journal pairs (JNL-x-A + JNL-x-B) collapse into a
  // single line showing both parties, so the day total counts the transfer once.
  const rows: Row[] = [];
  const used = new Set<string>();
  for (const v of V) {
    if (used.has(v.id)) continue;
    if (v.type === "journal" && /-[AB]$/.test(v.no)) {
      const base = v.no.replace(/-[AB]$/, "");
      const a = V.find(x => x.no === base + "-A");
      const b = V.find(x => x.no === base + "-B");
      if (a) used.add(a.id);
      if (b) used.add(b.id);
      if (a && b) {
        rows.push({ key: base, no: base, type: "journal",
          party: `Dr ${nameOf(a.party_id)} → Cr ${nameOf(b.party_id)}`,
          mode: v.mode, total: +a.total });
      } else {
        const leg = (a ?? b)!;
        rows.push({ key: leg.id, no: leg.no, type: "journal",
          party: nameOf(leg.party_id), mode: leg.mode,
          total: +leg.total, warn: true });
      }
    } else {
      used.add(v.id);
      rows.push({ key: v.id, no: v.no, type: v.type,
        party: nameOf(v.party_id), mode: v.mode, total: +v.total });
    }
  }
  const total = rows.reduce((t, r) => t + r.total, 0);

  return (
    <>
      <form className="tool" method="get">
        <input className="inp mono" type="date" name="d" defaultValue={date} style={{ width: 160 }} />
        <button className="btn sm">Go</button>
      </form>
      <div className="panel"><div className="tblw"><table className="t">
        <thead><tr><th>No</th><th>Type</th><th>Party</th><th>Mode</th><th className="num">Amount</th></tr></thead>
        <tbody>{rows.map(r => (
          <tr key={r.key}><td className="mono"><b>{r.no}</b></td>
            <td><span className="chip">{r.type}</span>
              {r.warn && <span className="chip red" style={{ marginLeft: 6 }}>pair incomplete</span>}</td>
            <td>{r.party}</td><td className="mut">{r.mode}</td>
            <td className="num" style={{ fontWeight: 700 }}>₹{r.total.toLocaleString("en-IN")}</td></tr>))}
          {!rows.length && <tr><td colSpan={5}><div className="empty">Quiet day — nothing posted.</div></td></tr>}
        </tbody>
        <tfoot><tr className="tfo"><td colSpan={4}>Day total — {dmy(date)}</td>
          <td className="num">₹{total.toLocaleString("en-IN")}</td></tr></tfoot>
      </table></div></div>
    </>
  );
}