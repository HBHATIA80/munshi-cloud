"use server";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth";

export async function updateAddressAction(addr: string, state: string) {
  const s = await requireCustomer();
  const sb = await createClient();
  const { error } = await sb.from("parties")
    .update({ addr, state }).eq("user_id", s.userId);
  if (error) throw new Error(error.message);
}

export async function cancelMyOrderAction(orderId: string) {
  const s = await requireCustomer();
  const sb = await createClient();
  // customers may cancel only their own, only while "placed" (not yet confirmed by the shop)
  const { data: o, error: e1 } = await sb.from("orders")
    .select("id,status,user_id,invoice_id").eq("id", orderId).eq("user_id", s.userId).single();
  if (e1 || !o) throw new Error("Order not found.");
  if (o.status !== "placed") throw new Error("The shop has already confirmed this order — contact them to change it.");
  const { error: e2 } = await sb.from("orders").update({ status: "cancelled" }).eq("id", orderId);
  if (e2) throw new Error(e2.message);
}