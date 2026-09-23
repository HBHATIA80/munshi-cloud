import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { BooksView } from "@/sections/money/BooksView";

export default async function BooksPage({ searchParams }:
  { searchParams: Promise<{ from?: string; to?: string; acct?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const sb = await createClient();
  const from = sp.from || new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const to = sp.to || new Date().toISOString().slice(0, 10);
  const [{ data: vs }, { data: ps }] = await Promise.all([
    sb.from("vouchers").select("*,parties(name)").gte("date", from).lte("date", to)
      .order("date").order("created_at"),
    sb.from("parties").select("id,name"),
  ]);
  const P = new Map((ps ?? []).map(p => [p.id, p.name]));
  const rows: any[] = [];
  const add = (v: any, acct: string, dr: number, cr: number) =>
    rows.push({ date: v.date, no: v.no, type: v.type, acct, dr, cr, narr: v.narr || "" });
  for (const v of (vs ?? []) as any[]) {
    if (v.opening) continue;
    const pn = v.parties?.name ?? "";
    if (v.type === "sale") {
      add(v, v.party_id ? (pn || "Sundry Debtor") : "Cash", v.total, 0);
      add(v, "Sales A/c", 0, v.taxable);
      if (v.is_gst) add(v, "GST Output", 0, v.tax);
      add(v, "Cost of Goods Sold", (v.lines ?? []).reduce((t: number, l: any) => t + (l.cost ?? 0) * l.qty, 0), 0);
      add(v, "Stock", 0, (v.lines ?? []).reduce((t: number, l: any) => t + (l.cost ?? 0) * l.qty, 0));
    } else if (v.type === "purchase") {
      add(v, "Stock", v.taxable, 0);
      if (v.is_gst) add(v, "GST Input", v.tax, 0);
      add(v, v.party_id ? (pn || "Sundry Creditor") : "Cash", 0, v.total);
    } else if (v.type === "receipt") {
      add(v, v.mode === "bank" ? "Bank" : v.mode === "upi" ? "UPI" : "Cash", v.total, 0);
      add(v, pn || "Sundry Debtor", 0, v.total);
    } else if (v.type === "payment") {
      add(v, pn || "Sundry Creditor", v.total, 0);
      add(v, v.mode === "bank" ? "Bank" : v.mode === "upi" ? "UPI" : "Cash", 0, v.total);
    } else if (v.type === "salret") {
      add(v, "Sales Return", v.total, 0);
      add(v, pn || "Sundry Debtor", 0, v.total);
    } else if (v.type === "purret") {
      add(v, pn || "Sundry Creditor", 0, v.total);
      add(v, "Stock", v.total, 0);
    } else if (v.type === "journal") {
      add(v, pn || "Journal", v.total, 0);
    }
  }
  const filtered = sp.acct
    ? rows.filter(r => r.acct.toLowerCase().includes(sp.acct!.toLowerCase()))
    : rows;
  const totDr = filtered.reduce((t, r) => t + r.dr, 0);
  const totCr = filtered.reduce((t, r) => t + r.cr, 0);
  return <BooksView rows={filtered} from={from} to={to} acct={sp.acct ?? ""}
    totDr={totDr} totCr={totCr} />;
}