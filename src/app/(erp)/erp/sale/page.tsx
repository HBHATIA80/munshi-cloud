import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SaleEntry } from "@/sections/invoicing/SaleEntry";

export default async function SalePage() {
  const s = await requireStaff();
  const sb = await createClient();
  const [{ data: items }, { data: parties }] = await Promise.all([
    sb.from("items").select("id,name,sku,unit,hsn,gst,cost,pr,ps,stock,has_serial")
      .eq("tenant_id", s.tenantId).order("name"),
    sb.from("parties").select("id,name,type,state,user_id")
      .eq("tenant_id", s.tenantId).order("name"),
  ]);
  return <SaleEntry items={(items ?? []) as any} parties={(parties ?? []) as any}
    homeState={s.tenant?.state ?? ""} tenantId={s.tenantId!} />;
}