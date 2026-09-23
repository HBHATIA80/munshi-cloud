import { requireSuper } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SuperAdmin } from "@/sections/platform/SuperAdmin";
import { LogoutBtn } from "@/sections/erp/LogoutBtn";

export default async function SAPage() {
  const s = await requireSuper();
  const sb = await createClient();
  const [{ data: tenants }, { data: profiles }, { data: vs },
         { data: upgrades }, { data: resets }] = await Promise.all([
    sb.from("tenants").select("*").order("created_at"),
    sb.from("profiles").select("tenant_id,role"),
    sb.from("vouchers").select("tenant_id,type,total").eq("type", "sale"),
    sb.from("upgrade_requests").select("*").order("created_at", { ascending: false }),
    sb.from("reset_requests").select("*").order("created_at", { ascending: false }),
  ]);
  const rows = (tenants ?? []).map(t => ({
    id: t.id, name: t.name, slug: t.slug, plan: t.plan, status: t.status,
    created: (t.created_at ?? "").slice(0, 10),
    joinCode: t.join_code,
    users: (profiles ?? []).filter(p => p.tenant_id === t.id).length,
    invoices: (vs ?? []).filter(v => v.tenant_id === t.id).length,
    gmv: (vs ?? []).filter(v => v.tenant_id === t.id).reduce((x, v) => x + +v.total, 0),
  }));
  const profMobile = new Map((profiles ?? []).map(p => [p.tenant_id + "|" + p.role, ""]));
  const ups = (upgrades ?? []).map(u => ({
    id: u.id, name: u.name ?? "", mobile: u.mobile ?? "", biz: u.biz_name,
    note: u.note ?? "", status: u.status, created: (u.created_at ?? "").slice(0, 10) }));
  const rsts = (resets ?? []).map(r => ({
    id: r.id, mobile: r.mobile, email: r.email ?? "", status: r.status,
    hasAccount: !!r.user_id, created: (r.created_at ?? "").slice(0, 10) }));
  void profMobile;
  return (
    <div id="wrap">
      <div className="tb"><span className="brand">Munshi<em>Cloud</em></span>
        <span className="nl">Platform Owner</span><span style={{ flex: 1 }} />
        <a className="nl" href="/">Public site</a>
        <LogoutBtn /></div>
      <div id="view" style={{ maxWidth: 1100 }}>
        <SuperAdmin tenants={rows} upgrades={ups} resets={rsts} meId={s.userId} />
      </div>
    </div>
  );
}