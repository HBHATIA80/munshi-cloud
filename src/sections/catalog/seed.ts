"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { TRADE_TEMPLATES } from "@/lib/templates";

export async function seedCatalogAction(trade: string)
  : Promise<{ error?: string; cats?: number; brands?: number }> {
  const s = await requireStaff();
  if (s.role !== "admin") return { error: "Only the owner can load starter catalogs." };
  if (!s.tenantId) return { error: "No tenant on session." };
  const tpl = TRADE_TEMPLATES[trade];
  if (!tpl) return { error: "Unknown trade type." };
  const sb = await createClient();

  const { data: existing } = await sb.from("categories").select("id,name,parent_id");
  const haveCat = new Set((existing ?? []).map(c => c.name.toLowerCase()));
  const haveSub = new Set((existing ?? []).filter(c => c.parent_id).map(c => c.name.toLowerCase()));

  let catCount = 0;
  for (const c of tpl.cats) {
    const existingParent = (existing ?? []).find(
      x => x.name.toLowerCase() === c.name.toLowerCase() && !x.parent_id);
    if (existingParent) {
      for (const sub of c.subs.filter(x => !haveSub.has(x.toLowerCase()))) {
        await sb.from("categories")
          .insert({ name: sub, parent_id: existingParent.id, tenant_id: s.tenantId });
        catCount++;
      }
      continue;
    }
    const { data: parent, error } = await sb.from("categories")
      .insert({ name: c.name, emoji: c.emoji, tenant_id: s.tenantId }).select("id").single();
    if (error) return { error: error.message };
    catCount++;
    for (const sub of c.subs) {
      await sb.from("categories")
        .insert({ name: sub, parent_id: parent.id, tenant_id: s.tenantId });
      catCount++;
    }
  }

  const { data: haveBrands } = await sb.from("brands").select("name");
  const haveB = new Set((haveBrands ?? []).map(b => b.name.toLowerCase()));
  let brandCount = 0;
  for (const b of tpl.brands.filter(x => !haveB.has(x.toLowerCase()))) {
    await sb.from("brands").insert({ name: b, tenant_id: s.tenantId });
    brandCount++;
  }
  revalidatePath("/erp/cats"); revalidatePath("/erp/items"); revalidatePath("/shop");
  return { cats: catCount, brands: brandCount };
}