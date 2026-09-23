import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ItemsView } from "@/sections/catalog/ItemsView";

export default async function ItemsPage() {
  await requireStaff();
  const sb = await createClient();
const [{ data: items }, { data: cats }, { data: brands }] = await Promise.all([
  sb.from("items").select("*").order("name"),
  sb.from("categories").select("*").order("name"),
  sb.from("brands").select("*").order("name"),
]);
return <ItemsView items={(items ?? []) as any} cats={(cats ?? []) as any} brands={(brands ?? []) as any} />;
}