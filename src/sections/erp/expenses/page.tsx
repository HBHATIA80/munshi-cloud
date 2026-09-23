import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ExpensesView } from "@/sections/expenses/ExpensesView";

export default async function ExpensesPage() {
  await requireStaff();
  const sb = await createClient();
  const m = new Date().toISOString().slice(0, 7);
  const { data: rows } = await sb.from("expenses").select("*")
    .gte("date", m + "-01").order("date", { ascending: false });
  const { data: all } = await sb.from("expenses").select("head");
  return <ExpensesView rows={(rows ?? []) as any}
    heads={[...new Set((all ?? []).map(x => x.head))] as any} />;
}