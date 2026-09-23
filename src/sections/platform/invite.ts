"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { customerCap } from "@/lib/plans";

export async function inviteMemberAction(fd: FormData)
  : Promise<{ error?: string; temp?: string; existing?: boolean }> {
  const s = await requireStaff();
  if (s.role !== "admin") return { error: "Only the owner can invite." };
  if (!s.tenantId || !s.tenant) return { error: "No tenant on session." };
  const g = (k: string) => String(fd.get(k) || "").trim();
  const mobile = g("mobile").replace(/\D/g, "");
  const name = g("name");
  const role = g("role") === "staff" ? "staff" : "customer";
  if (name.length < 2 || mobile.length < 10)
    return { error: "Name and a valid mobile are required." };

  const sb = await createClient();
  const { data: tn } = await sb.from("tenants")
    .select("id,plan,slug,state,status").eq("id", s.tenantId).single();
  if (tn?.status !== "active") return { error: "Your shop is suspended." };

  if (role === "customer") {
    const { count } = await sb.from("parties")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", s.tenantId).in("type", ["customer", "retailer"]);
    if ((count ?? 0) >= customerCap(tn?.plan))
      return { error: `Customer limit reached for the ${tn?.plan ?? "trial"} plan (${customerCap(tn?.plan)}).` };
  }

  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("id").eq("mobile", mobile).maybeSingle();

  /* account exists → just link it */
  if (prof) {
    const { data: mem } = await admin.from("memberships")
      .select("id").eq("user_id", prof.id).eq("tenant_id", s.tenantId).maybeSingle();
    if (mem) return { error: "This person is already linked with your shop." };
    const { error: e1 } = await admin.from("memberships")
      .insert({ user_id: prof.id, tenant_id: s.tenantId, role });
    if (e1) return { error: e1.message };
    if (role === "customer") {
      const { data: p } = await admin.from("parties")
        .select("id").eq("user_id", prof.id).eq("tenant_id", s.tenantId).maybeSingle();
      if (!p) {
        const { error: e2 } = await admin.from("parties").insert({
          tenant_id: s.tenantId, user_id: prof.id, name,
          type: "customer", mobile, state: tn.state });
        if (e2) return { error: e2.message };
      }
    }
    await admin.from("notifications").insert({ user_id: prof.id, tenant_id: s.tenantId,
      kind: "invite_added", payload: { role, tenant: s.tenant.name } });
    return { existing: true };
  }

  /* no account → create it with a temp password; the signup trigger
     builds profile + party/membership from metadata */
  const temp = "Mc" + Math.random().toString(36).slice(2, 8) + "1!";
  const { error } = await admin.auth.admin.createUser({
    email: mobile + "@munshi.users", password: temp, email_confirm: true,
    user_metadata: { name, mobile,
      role: role === "staff" ? "staff" : "retailer", tenant_slug: tn.slug },
  });
  if (error) return { error: error.message.includes("already registered")
    ? "This mobile already has an account — try again in a moment." : error.message };
  return { temp };
}