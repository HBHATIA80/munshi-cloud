import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/sections/store/CartFlow";

export default async function CheckoutPage({ searchParams }:
  { searchParams: Promise<{ shop?: string }> }) {
  const s = await requireSession();
  const { shop } = await searchParams;
  const membership = s.memberships.find(m => m.tenantId === shop && m.role === "customer");
  if (!shop || !membership) redirect("/cart");
  const sb = await createClient();
  const [{ data: tn }, { data: p }] = await Promise.all([
    sb.from("tenants").select("name,state").eq("id", shop).single(),
    sb.from("parties").select("type,addr,state").eq("user_id", s.userId).eq("tenant_id", shop).limit(1),
  ]);
  return <><h2 style={{ marginBottom: 14 }}>Checkout</h2>
    <CheckoutForm shopId={shop} shopName={tn?.name ?? "Shop"}
      trade={(p?.[0]?.type ?? "") === "shopkeeper"} homeState={tn?.state ?? ""}
      defaultAddr={p?.[0]?.addr ?? ""} defaultState={p?.[0]?.state ?? ""} /></>;
}