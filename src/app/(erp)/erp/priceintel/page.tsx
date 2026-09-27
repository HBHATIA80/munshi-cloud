import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PriceIntelClient } from "@/sections/invoicing/PriceIntelClient";

export default async function PriceIntelPage() {
  await requireStaff();
  const sb = await createClient();
  const { data: items } = await sb.from("items").select("id,name,sku,cost").order("name");
  return <PriceIntelClient items={(items ?? []) as { id: string; name: string; sku: string; cost: number }[]} />;
}