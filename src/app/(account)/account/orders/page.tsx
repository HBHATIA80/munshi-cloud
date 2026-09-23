import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { myBooks } from "@/sections/account/ui";
import { OrdersClient } from "@/sections/account/OrdersClient";

export default async function MyOrdersPage() {
  const s = await requireCustomer();
  const sb = await createClient();
  const { data: orders } = await sb.from("orders").select("*")
    .eq("user_id", s.userId).order("created_at", { ascending: false });
  const { vs } = await myBooks();
  const invNo = (id: string | null) =>
    (vs ?? []).find((v: { id: string; no: string }) => v.id === id)?.no ?? null;
  return <OrdersClient orders={(orders ?? []).map((o: any) => ({
    id: o.id, no: o.no, date: o.date,
    items: (o.lines ?? []).map((l: any) => `${l.name} ×${l.qty}`).join(", "),
    total: +o.total, pay: o.pay, status: o.status,
    invoiceId: o.invoice_id, invoiceNo: invNo(o.invoice_id),
  }))} />;
}