import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MoneyView } from "@/sections/money/MoneyView";

const PER = 50;

export default async function PayPage({ searchParams }:
  { searchParams: Promise<{ page?: string }> }) {
  await requireStaff();
  const { page } = await searchParams;
  const pg = Math.max(1, +page || 1);
  const sb = await createClient();
  const [{ data: hist }, { data: parties }] = await Promise.all([
    sb.from("vouchers").select("*").eq("type", "payment")
      .order("date", { ascending: false }),
    sb.from("parties").select("id,name,type").order("name"),
  ]);
  const P = new Map((parties ?? []).map(p => [p.id, p.name]));
  const rows = ((hist ?? []) as any[]).map(v => ({
    no: v.no, date: v.date, party: P.get(v.party_id) ?? "—",
    mode: v.mode, total: +v.total, narr: v.narr,
  }));
  return <MoneyView type="payment" parties={(parties ?? []) as any} history={rows} />;
}