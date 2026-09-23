import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OrdersView } from "@/sections/platform/OrdersView";

export default async function OrdersPage() {
  const s = await requireStaff();
  const sb = await createClient();
  const [{ data: orders }, { data: profs }, { data: invs }] = await Promise.all([
    sb.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
    sb.from("profiles").select("id,name,mobile"),
    sb.from("vouchers").select("id,no,total,paid").eq("type", "sale"),
  ]);
  const invMap = new Map((invs ?? []).map(v => [v.id, v]));
  const rows = (orders ?? []).map(o => {
    const u = (profs ?? []).find(x => x.id === o.user_id);
    const inv = o.invoice_id ? invMap.get(o.invoice_id) : null;
    return {
      id: o.id, no: o.no, date: o.date,
      customer: u?.name ?? "", mobile: u?.mobile ?? "",
      items: (o.lines ?? []).map((l: any) => `${l.name} ×${l.qty}`).join(", "),
      total: +o.total, pay: o.pay, status: o.status,
      invoiceId: o.invoice_id, invoiceNo: inv?.no ?? "",
      paid: +(inv?.paid ?? 0),
    };
  });
  return <OrdersView orders={rows} shopName={s.tenant?.name ?? "Shop"} />;
}