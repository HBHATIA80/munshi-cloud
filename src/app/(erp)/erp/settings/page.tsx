import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "@/sections/platform/SettingsForm";
import { PasswordCard } from "@/sections/platform/PasswordCard";

export default async function SettingsPage() {
  const s = await requireStaff();
  const sb = await createClient();
  const { data: tn } = await sb.from("tenants").select("*").eq("id", s.tenantId!).single();
  const st = tn?.settings ?? {};
  return (
    <>
      <SettingsForm tn={{
        name: tn?.name ?? "", addr: tn?.addr ?? "", phone: tn?.phone ?? "",
        gstin: tn?.gstin ?? "", state: tn?.state ?? "",
        font_body: st.font_body ?? "Karla", font_disp: st.font_disp ?? "Fraunces",
        low: st.low ?? 5, slabs: (st.slabs ?? [0, 5, 12, 18, 28]).join(","),
      }} isAdmin={s.role === "admin"} />
      <PasswordCard />
    </>
  );
}