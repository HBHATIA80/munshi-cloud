"use server";
import { createClient, } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTIVE_TENANT_COOKIE, requireSession } from "@/lib/auth";

const emailOf = (m: string) => m.replace(/\D/g, "") + "@munshi.users";

/* ---------------- login → portfolio hub ---------------- */
export async function loginAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const mobile = String(fd.get("mobile") || "").replace(/\D/g, "");
  const password = String(fd.get("password") || "");
  if (mobile.length < 10 || !password) return "Enter your mobile number and password.";
  const sb = await createClient();
  const { error } = await sb.auth.signInWithPassword({ email: emailOf(mobile), password });
  if (error) return error.message === "Invalid login credentials"
    ? "Wrong mobile or password." : error.message;
  redirect("/portfolio");
}

/* ---------------- customer signup (public) ---------------- */
export async function signupCustomerAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const name = String(fd.get("name") || "").trim();
  const mobile = String(fd.get("mobile") || "").replace(/\D/g, "");
  const password = String(fd.get("password") || "");
  const biz = String(fd.get("biz") || "").trim(); // optional: their own shop name
  if (!name || mobile.length < 10 || password.length < 6)
    return "Name, valid mobile and a 6+ character password are required.";
  const sb = await createClient();
  const { data, error } = await sb.auth.signUp({
    email: emailOf(mobile), password,
    options: { data: { name, mobile, role: "retailer",
      tenant_slug: process.env.NEXT_PUBLIC_STORE_SLUG } },
  });
  if (error) return error.message.includes("already registered")
    ? "This mobile is already registered — please log in instead." : error.message;
  if (!data.session) {
    const { error: e2 } = await sb.auth.signInWithPassword({ email: emailOf(mobile), password });
    if (e2) return e2.message;
  }
  // optional: they also want their own business workspace right away
  if (biz) redirect(`/onboard-biz?name=${encodeURIComponent(biz)}`);
  redirect("/portfolio");
}

/* ---------------- business signup (now PUBLIC) ---------------- */
export async function signupBizAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const g = (k: string) => String(fd.get(k) || "").trim();
  const slug = g("slug").toLowerCase();
  const mobile = g("mobile").replace(/\D/g, "");
  if (!g("biz") || !slug || !g("state") || !g("name") ||
      mobile.length < 10 || g("password").length < 6)
    return "Business, slug, state, your name, valid mobile and a 6+ char password are required.";
  const sb = await createClient();
  const { data: slugTaken } = await sb.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (slugTaken) return `Store slug "${slug}" is already taken — please choose a different one.`;
  const { data, error } = await sb.auth.signUp({
    email: emailOf(mobile), password: g("password"),
    options: { data: { name: g("name"), mobile, role: "admin", biz: g("biz"),
      slug, state: g("state"), gstin: g("gstin"), addr: g("addr"), phone: g("phone") } },
  });
  if (error) return error.message.includes("already registered")
    ? "This mobile is already registered — please log in instead." : error.message;
  if (!data.session) {
    const { error: e2 } = await sb.auth.signInWithPassword({ email: emailOf(mobile), password: g("password") });
    if (e2) return e2.message;
  }
  redirect("/erp");
}

/* ---------------- onboard another business for an EXISTING login ---------------- */
export async function createBusinessAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const s = await requireSession();
  const g = (k: string) => String(fd.get(k) || "").trim();
  const slug = g("slug").toLowerCase();
  if (!g("biz") || !slug || !g("state")) return "Business name, slug and state are required.";
  const sb = await createClient();
  const { data: slugTaken } = await sb.from("tenants").select("id").eq("slug", slug).maybeSingle();
  if (slugTaken) return `Store slug "${slug}" is already taken.`;
  const admin = createAdminClient();
  const { data: tn, error: e1 } = await admin.from("tenants").insert({
    name: g("biz"), slug, state: g("state"), gstin: g("gstin"),
    addr: g("addr"), phone: g("phone"),
  }).select("id").single();
  if (e1) return e1.message;
  await admin.from("counters").insert({ tenant_id: tn.id });
  await admin.from("memberships").insert({ user_id: s.userId, tenant_id: tn.id, role: "admin" });
  await setActiveTenantAction(tn.id);
  redirect("/erp");
}

/* ---------------- hidden: platform owner setup (key-protected, one-shot) ---------------- */
export async function ownerSetupAction(_prev: string | null, fd: FormData): Promise<string | null> {
  const key = String(fd.get("key") || "");
  if (key !== (process.env.SETUP_KEY || "")) return "Invalid setup key.";
  const name = String(fd.get("name") || "").trim();
  const mobile = String(fd.get("mobile") || "").replace(/\D/g, "");
  const password = String(fd.get("password") || "");
  if (!name || mobile.length < 10 || password.length < 6)
    return "Name, valid mobile and a 6+ char password are required.";
  const admin = createAdminClient();
  const { data: existing } = await admin.from("profiles").select("id").eq("role", "superadmin").limit(1);
  if (existing && existing.length) return "An owner already exists. This page is closed.";
  const { error } = await admin.auth.admin.createUser({
    email: emailOf(mobile), password, email_confirm: true,
    user_metadata: { name, mobile, role: "superadmin" },
  });
  if (error) return error.message;
  redirect("/login");
}

/* ---------------- switch active business ---------------- */
export async function setActiveTenantAction(tenantId: string) {
  await requireSession();
  const sb = await createClient();
  const { data: ok } = await sb.from("memberships").select("id")
    .eq("user_id", (await sb.auth.getUser()).data.user!.id)
    .eq("tenant_id", tenantId).eq("status", "active").single();
  if (!ok) throw new Error("Not a member of that business.");
  const jar = await cookies();
  jar.set(ACTIVE_TENANT_COOKIE, tenantId, { path: "/", maxAge: 60 * 60 * 24 * 30, sameSite: "lax" });
}

export async function logoutAction() {
  const sb = await createClient();
  await sb.auth.signOut();
  redirect("/");
}