"use server";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";

/** Fetch cart items scoped to ONE shop — cross-shop lines are never returned. */
export async function getCartItems(tenantId: string, ids: string[]) {
  if (!ids.length) return [];
  const sb = await createClient();
  const { data } = await sb.from("items")
    .select("id,name,sku,pr,ps,gst,stock,image_url")
    .in("id", ids).eq("tenant_id", tenantId);
  return (data ?? []) as { id: string; name: string; sku: string; pr: number;
    ps: number; gst: number; stock: number; image_url: string }[];
}

/** Shop names for the grouped cart view. */
export async function getShopNames(ids: string[]) {
  if (!ids.length) return [];
  const sb = await createClient();
  const { data } = await sb.from("tenants").select("id,name,slug").in("id", ids);
  return (data ?? []) as { id: string; name: string; slug: string }[];
}

/**
 * Place an order at ONE shop. Server-side SQL validates membership,
 * recomputes prices by party type, deducts stock and creates the invoice.
 * pay: "cod" | "advance" | "account"  (online gateway comes later)
 */
export async function placeOrderAction(
  tenantId: string, lines: { id: string; qty: number }[], addr: string, pay: string) {
  const s = await getSession();
  if (!s) return { error: "Please log in." };
  if (s.role !== "customer" || s.tenantId !== tenantId)
    return { error: "Open this shop through your portfolio first." };
  const sb = await createClient();
  const { data, error } = await sb.rpc("place_order", {
    p_tenant: tenantId,
    p_lines: lines.map(l => ({ item_id: l.id, qty: l.qty })),
    p_addr: addr, p_pay: pay });
  if (error) return { error: error.message };
  return { data };
}