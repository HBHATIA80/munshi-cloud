import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CatsView } from "@/sections/catalog/CatsView";
import { SeedCatalog } from "@/sections/catalog/SeedCatalog";

export default async function CatsPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: cats }, { data: brands }, { data: items }] = await Promise.all([
    sb.from("categories").select("*").order("name"),
    sb.from("brands").select("*").order("name"),
    sb.from("items").select("cat_id,brand_id"),
  ]);
  const catCounts: Record<string, number> = {}, brandCounts: Record<string, number> = {};
  (items ?? []).forEach(i => {
    if (i.cat_id) catCounts[i.cat_id] = (catCounts[i.cat_id] ?? 0) + 1;
    if (i.brand_id) brandCounts[i.brand_id] = (brandCounts[i.brand_id] ?? 0) + 1;
  });
  return (
    <>
      <SeedCatalog hasCatalog={(cats ?? []).length > 0} />
      <CatsView cats={(cats ?? []) as any} brands={(brands ?? []) as any}
        catCounts={catCounts} brandCounts={brandCounts} />
    </>
  );
}