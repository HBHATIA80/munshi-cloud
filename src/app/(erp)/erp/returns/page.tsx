import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ReturnsView } from "@/sections/invoicing/ReturnsView";

export default async function ReturnsPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: sales }, { data: purchases }] = await Promise.all([
    sb.from("vouchers").select("id,no,date,total,lines").eq("type", "sale").order("date", { ascending: false }).limit(100),
    sb.from("vouchers").select("id,no,date,total,lines").eq("type", "purchase").order("date", { ascending: false }).limit(100),
  ]);
  return <ReturnsView sales={(sales ?? []) as any} purchases={(purchases ?? []) as any} />;
}