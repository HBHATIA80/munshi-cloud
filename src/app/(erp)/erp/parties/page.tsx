import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PartiesView } from "@/sections/catalog/PartiesView";
import { partyBalance, type Voucher, type Party } from "@/lib/books";
import { customerCap } from "@/lib/plans";

export default async function PartiesPage() {
  const s = await requireStaff();
  const sb = await createClient();
  const [{ data: parties }, { data: vs }, { data: tn }] = await Promise.all([
    sb.from("parties").select("*").order("name"),
    // `no` is required so partyBalance can classify journal legs (-A Dr / -B Cr)
    sb.from("vouchers").select("party_id,type,total,no"),
    sb.from("tenants").select("plan").eq("id", s.tenantId!).single(),
  ]);
  const V = (vs ?? []) as unknown as Voucher[];
  const rows = ((parties ?? []) as unknown as Party[]).map(p => ({
    id: p.id, name: p.name, type: p.type, mobile: p.mobile, state: p.state,
    gstin: p.gstin ?? "", addr: p.addr ?? "",
    open: +p.open, balance: partyBalance(V, p), appLinked: !!p.user_id,
  }));
  const used = rows.filter(r => r.type === "customer" || r.type === "retailer").length;
  return <PartiesView rows={rows} cap={customerCap(tn?.plan)} used={used} />;
}