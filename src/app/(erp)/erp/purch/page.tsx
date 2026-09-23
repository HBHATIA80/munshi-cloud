import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PurchEntry } from "@/sections/invoicing/PurchEntry";

export default async function PurchPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: items }, { data: suppliers }] = await Promise.all([
    sb.from("items").select("id,name,sku,unit,hsn,gst,cost").order("name"),
    sb.from("parties").select("id,name").eq("type", "supplier").order("name"),
  ]);
  return <PurchEntry items={(items ?? []) as any} suppliers={(suppliers ?? []) as any} />;
}