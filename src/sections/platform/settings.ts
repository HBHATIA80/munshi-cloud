"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";

export async function saveTenantSettingsAction(fd: FormData): Promise<{ error?: string }> {
  const s = await requireStaff();
  if (s.role !== "admin") return { error: "Only the owner can change settings." };
  const sb = await createClient();
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const slabs = g("slabs").split(",").map(x => +x.trim()).filter(x => x >= 0 && x <= 28);
  const { error } = await sb.from("tenants").update({
    name: g("name") || s.tenant?.name, addr: g("addr"), phone: g("phone"),
    gstin: g("gstin"), state: g("state"),
    settings: {
      font_body: g("font_body") || "Karla", font_disp: g("font_disp") || "Fraunces",
      low: +g("low") || 5,
      slabs: slabs.length ? slabs : [0, 5, 12, 18, 28],
    },
  }).eq("id", s.tenantId!);
  if (error) return { error: error.message };
  revalidatePath("/erp/settings"); revalidatePath("/shop");
  return {};
}