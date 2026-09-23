import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RegistersView } from "@/sections/invoicing/RegistersView";
import { TrendChartBtn } from "@/components/TrendChart";

const PER = 50;
function rangeFor(preset: string): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().slice(0, 10);
  if (preset === "7")  return { from: new Date(today.getTime() - 6 * 864e5).toISOString().slice(0, 10), to };
  if (preset === "14") return { from: new Date(today.getTime() - 13 * 864e5).toISOString().slice(0, 10), to };
  if (preset === "30") return { from: new Date(today.getTime() - 29 * 864e5).toISOString().slice(0, 10), to };
  return { from: "2000-01-01", to };
}

export default async function SalesRegPage({ searchParams }:
  { searchParams: Promise<{ page?: string; range?: string; from?: string; to?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
   const pg = Math.max(1, +(sp.page ?? 1) || 1);
  const preset = sp.range || "30";
  const { from, to } = preset === "custom" && sp.from
    ? { from: sp.from, to: sp.to || new Date().toISOString().slice(0, 10) }
    : rangeFor(preset);

  const sb = await createClient();
  const [{ count, data: vs }, { data: ps }] = await Promise.all([
    sb.from("vouchers").select("*").eq("type", "sale")
      .gte("date", from).lte("date", to)
      .order("date", { ascending: false }),
    sb.from("parties").select("id,name"),
  ]);
  const P = new Map((ps ?? []).map(p => [p.id, p.name]));
  const list = (vs ?? []) as any[];
  const total = list.length;
  const pages = Math.max(1, Math.ceil(total / PER));
  const rows = list.slice((pg - 1) * PER, pg * PER).map(v => ({
    id: v.id, no: v.no, date: v.date, party: P.get(v.party_id) ?? "Cash",
    taxable: +v.taxable, tax: +v.tax, total: +v.total, paid: +v.paid, is_gst: v.is_gst,
  }));

  const gross = list.reduce((t, v) => t + +v.total, 0);
  const paid = list.reduce((t, v) => t + +v.paid, 0);
  const cogs = list.reduce((t, v) => t + (v.lines ?? []).reduce((t2: number, l: any) => t2 + (l.cost ?? 0) * l.qty, 0), 0);
  const profit = gross - cogs;
  const due = gross - paid;

  const m: Record<string, number> = {};
  list.forEach(v => { m[v.date] = (m[v.date] || 0) + +v.total; });
  const chartData = Object.entries(m).sort(([a], [b]) => a.localeCompare(b))
    .map(([day, t]) => ({ day, total: t }));

  const qs = (over: Record<string, string>) => {
    const p = new URLSearchParams({ range: preset, from, to, ...over });
    return `/erp/sales?${p.toString()}`;
  };

  return (
    <>
      <div className="tool">
        {[["7", "7 days"], ["14", "14 days"], ["30", "30 days"], ["all", "All"], ["custom", "Custom"]].map(([k, l]) => (
          <a key={k} className={"fchip" + (preset === k ? " on" : "")} href={qs({ page: "1" })}>{l}</a>
        ))}
        {preset === "custom" && (
          <form method="get" style={{ display: "flex", gap: 6 }}>
            <input type="hidden" name="range" value="custom" />
            <input className="inp mono" type="date" name="from" defaultValue={from} style={{ width: 135 }} />
            <input className="inp mono" type="date" name="to" defaultValue={to} style={{ width: 135 }} />
            <button className="btn sm">Go</button>
          </form>)}
      </div>

      <div className="kpis" style={{ marginBottom: 14 }}>
        <div className="kpi"><div className="l">Sales</div>
          <div className="v">₹{Math.round(gross).toLocaleString("en-IN")}</div>
          <div className="s">{total} bills</div></div>
        <div className="kpi"><div className="l">Profit</div>
          <div className="v pos">₹{Math.round(profit).toLocaleString("en-IN")}</div>
          <div className="s">{gross ? (profit / gross * 100).toFixed(1) : "0"}% margin</div></div>
        <div className="kpi"><div className="l">Received</div>
          <div className="v">₹{Math.round(paid).toLocaleString("en-IN")}</div>
          <div className="s">{gross ? (paid / gross * 100).toFixed(1) : "0"}% collected</div></div>
        <div className="kpi"><div className="l">Outstanding</div>
          <div className="v neg">₹{Math.round(due).toLocaleString("en-IN")}</div>
          <div className="s">to collect</div></div>
      </div>

      <div className="tool">
        <TrendChartBtn title="Sales" data={chartData} color="#2f6b4f" />
        <span style={{ flex: 1 }} />
        <span className="mut" style={{ fontSize: 12 }}>page {pg} of {pages}</span>
        {pg > 1 && <a className="btn sm" href={qs({ page: String(pg - 1) })}>← Prev</a>}
        {pg < pages && <a className="btn sm" href={qs({ page: String(pg + 1) })}>Next →</a>}
      </div>

      <RegistersView rows={rows} kind="sale" editableNo />
    </>
  );
}