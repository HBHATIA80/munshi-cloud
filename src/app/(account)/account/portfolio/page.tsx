import { requireSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PortfolioView } from "@/sections/platform/PortfolioView";

export default async function PortfolioPage() {
  const s = await requireSession();
  const sb = await createClient();

  /* shop codes — only for memberships where the user is owner/staff */
  const staffIds = s.memberships
    .filter(m => m.role === "admin" || m.role === "staff")
    .map(m => m.tenantId);
  const { data: codeRows } = staffIds.length
    ? await sb.from("tenants").select("id,join_code").in("id", staffIds)
    : { data: [] };
  const joinCodes: Record<string, string> = {};
  (codeRows ?? []).forEach(r => { joinCodes[r.id] = r.join_code; });

  /* per-shop dues & order counts for customer memberships */
  const dues: Record<string, number> = {};
  const ordersCount: Record<string, number> = {};
  for (const m of s.memberships.filter(m => m.role === "customer")) {
    const { data: p } = await sb.from("parties")
      .select("id,open").eq("user_id", s.userId).eq("tenant_id", m.tenantId).limit(1);
    if (!p?.[0]) continue;
    const { data: vs } = await sb.from("vouchers")
      .select("type,total,paid").eq("party_id", p[0].id);
    const saleDue = (vs ?? []).filter(v => v.type === "sale")
      .reduce((t, v) => t + v.total - v.paid, 0);
    const credit = (vs ?? []).filter(v => v.type === "salret")
      .reduce((t, v) => t + v.total, 0);
    dues[m.tenantId] = Math.max(0, Math.round(saleDue - credit + +(p[0].open || 0)));
    const { count } = await sb.from("orders")
      .select("id", { count: "exact", head: true })
      .eq("user_id", s.userId).eq("tenant_id", m.tenantId);
    ordersCount[m.tenantId] = count ?? 0;
  }

  /* pending shopkeeper application? */
  const { data: pend } = await sb.from("upgrade_requests")
    .select("status").eq("user_id", s.userId).eq("status", "pending").maybeSingle();

  return (
    <PortfolioView
      name={s.name}
      isSuper={s.isSuper}
      memberships={s.memberships.map(m => ({
        tenantId: m.tenantId, role: m.role,
        name: m.tenant.name, slug: m.tenant.slug, state: m.tenant.state,
      }))}
      joinCodes={joinCodes}
      pendingUpgrade={!!pend}
      dues={dues}
      ordersCount={ordersCount}
    />
  );
}