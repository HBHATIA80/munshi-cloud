"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, requireCustomer, requireSession, requireSuper } from "@/lib/auth";
import { customerCap } from "@/lib/plans";

/* ---------------- own password ---------------- */
export async function changeMyPasswordAction(fd: FormData): Promise<{ error?: string }> {
  const np = String(fd.get("np") || "");
  if (np.length < 6) return { error: "New password must be 6+ characters." };
  const sb = await createClient();
  const { error } = await sb.auth.updateUser({ password: np });
  if (error) return { error: error.message };
  return {};
}

/* ---------------- admin resets a user's password ---------------- */
export async function resetUserPasswordAction(userId: string, np: string): Promise<{ error?: string }> {
  const s = await requireStaff();
  if (s.role !== "admin") return { error: "Only the owner can reset passwords." };
  if (np.length < 6) return { error: "6+ characters." };
  const sb = await createClient();
  const { data: prof } = await sb.from("profiles").select("id").eq("id", userId).single();
  if (!prof) return { error: "User not in your business." };
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { password: np });
  if (error) return { error: error.message };
  return {};
}

/* ---------------- customer joins a shop by code ---------------- */
export async function joinShopAction(fd: FormData): Promise<{ error?: string; shop?: string }> {
  const s = await requireSession();
  const code = String(fd.get("code") || "").trim().toUpperCase();
  if (code.length < 4) return { error: "Enter the shop code your trader gave you." };
  const sb = await createClient();
  const { data: tn } = await sb.from("tenants")
    .select("id,name,status,plan,state").eq("join_code", code).maybeSingle();
  if (!tn) return { error: "No shop found with that code — check and try again." };
  if (tn.status !== "active") return { error: "That shop is not accepting customers right now." };
  const { data: mem } = await sb.from("memberships")
    .select("id").eq("user_id", s.userId).eq("tenant_id", tn.id).maybeSingle();
  if (mem) return { error: `You are already linked with ${tn.name}.` };
  const { count } = await sb.from("parties")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tn.id).eq("type", "customer");
  if ((count ?? 0) >= customerCap(tn.plan))
    return { error: `${tn.name} has reached its customer limit (${customerCap(tn.plan)}). Ask them to upgrade their plan.` };
  // RLS blocks customers from inserting parties/memberships — validated above, so service role is correct here
  const admin = createAdminClient();
  const { error: e1 } = await admin.from("parties").insert({
    tenant_id: tn.id, user_id: s.userId, name: s.name || "Customer",
    type: "customer", mobile: s.mobile, state: tn.state });
  if (e1 && !e1.message.includes("duplicate")) return { error: e1.message };
  await admin.from("memberships")
    .upsert({ user_id: s.userId, tenant_id: tn.id, role: "customer" },
            { onConflict: "user_id,tenant_id" });
  return { shop: tn.name };
}

/* ---------------- customer applies to become a shopkeeper ---------------- */
export async function applyUpgradeAction(fd: FormData): Promise<{ error?: string }> {
  const s = await requireSession();
  const biz = String(fd.get("biz") || "").trim();
  const note = String(fd.get("note") || "").trim();
  if (biz.length < 3) return { error: "Enter your shop/business name." };
  const sb = await createClient();
  const { data: dup } = await sb.from("upgrade_requests")
    .select("id").eq("user_id", s.userId).eq("status", "pending").maybeSingle();
  if (dup) return { error: "You already have a pending request." };
  const { error } = await sb.from("upgrade_requests")
    .insert({ user_id: s.userId, mobile: s.mobile, name: s.name, biz_name: biz, note });
  if (error) return { error: error.message };
  return {};
}

/* ---------------- super admin reviews upgrade applications ---------------- */
export async function reviewUpgradeAction(id: string, approve: boolean)
  : Promise<{ error?: string; shopName?: string }> {
  const s = await requireSuper();
  const admin = createAdminClient();
  const { data: req } = await admin.from("upgrade_requests").select("*").eq("id", id).single();
  if (!req || req.status !== "pending") return { error: "Request not found or already handled." };
  if (!approve) {
    await admin.from("upgrade_requests")
      .update({ status: "rejected", reviewed_by: s.userId, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    return {};
  }
  const base = req.biz_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "shop";
  let slug = base; let n = 0;
  for (;;) {
    const { data: taken } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
    if (!taken) break;
    n++; slug = `${base}-${n}`;
  }
  const { data: tn, error: e1 } = await admin.from("tenants")
    .insert({ name: req.biz_name, slug }).select("id").single();
  if (e1) return { error: e1.message };
  await admin.from("counters").insert({ tenant_id: tn.id });
  await admin.from("memberships").insert({ user_id: req.user_id, tenant_id: tn.id, role: "admin" });
  await admin.from("upgrade_requests")
    .update({ status: "approved", reviewed_by: s.userId, reviewed_at: new Date().toISOString() })
    .eq("id", id);
  revalidatePath("/sa");
  return { shopName: req.biz_name };
}

/* ---------------- public: forgot password request ---------------- */
export async function submitResetRequestAction(fd: FormData): Promise<{ error?: string }> {
  const mobile = String(fd.get("mobile") || "").replace(/\D/g, "");
  const email = String(fd.get("email") || "").trim();
  if (mobile.length < 10) return { error: "Enter your mobile number." };
  const sb = await createClient();
  const admin = createAdminClient();
  const { data: prof } = await admin.from("profiles").select("id").eq("mobile", mobile).maybeSingle();
  const { error } = await sb.from("reset_requests")
    .insert({ user_id: prof?.id ?? null, mobile, email });
  if (error) return { error: error.message };
  return {};
}

/* ---------------- super admin handles reset requests ---------------- */
export async function reviewResetAction(id: string, approve: boolean)
  : Promise<{ error?: string; temp?: string; email?: string | null }> {
  const s = await requireSuper();
  const admin = createAdminClient();
  const { data: req } = await admin.from("reset_requests").select("*").eq("id", id).single();
  if (!req) return { error: "Request not found." };
  if (req.status !== "pending") return { error: "Already handled." };
  if (!approve) {
    await admin.from("reset_requests")
      .update({ status: "rejected", handled_by: s.userId, handled_at: new Date().toISOString() })
      .eq("id", id);
    return {};
  }
  let uid = req.user_id as string | null;
  if (!uid && req.mobile) {
    const { data: prof } = await admin.from("profiles").select("id").eq("mobile", req.mobile).maybeSingle();
    uid = prof?.id ?? null;
  }
  if (!uid) {
    await admin.from("reset_requests")
      .update({ status: "rejected", handled_by: s.userId, handled_at: new Date().toISOString() })
      .eq("id", id);
    return { error: "No account found for that mobile — request closed." };
  }
  const temp = "Mc" + Math.random().toString(36).slice(2, 8) + "1!";
  const { error: e1 } = await admin.auth.admin.updateUserById(uid, { password: temp });
  if (e1) return { error: e1.message };
  await admin.from("reset_requests")
    .update({ status: "done", handled_by: s.userId, handled_at: new Date().toISOString() })
    .eq("id", id);
  return { temp, email: req.email };
}