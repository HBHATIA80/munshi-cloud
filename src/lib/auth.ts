import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export type MRole = "admin" | "staff" | "customer";
export type Membership = {
  tenantId: string; role: MRole;
  tenant: { id: string; name: string; slug: string; state: string; status: string };
};
export type Session = {
  userId: string;
  name: string;
  mobile: string | null;
  isSuper: boolean;
  memberships: Membership[];
  tenantId: string | null;      // ACTIVE tenant (cookie or sensible default)
  role: MRole | null;           // role in the ACTIVE tenant
  tenant: Membership["tenant"] | null;
  partyType: string | null;     // "customer" | "shopkeeper" | "supplier" | "retailer" — in the ACTIVE tenant
  trade: boolean;               // true = shopkeeper in the ACTIVE tenant (trade pricing)
};

export const ACTIVE_TENANT_COOKIE = "mc_t";

export async function getSession(): Promise<Session | null> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;

  const { data: prof } = await sb.from("profiles")
    .select("name,mobile,role,status").eq("id", user.id).single();
  if (!prof || prof.status !== "active") return null;

  // all active memberships with their tenant info
  const { data: ms } = await sb.from("memberships")
    .select("tenant_id,role,tenants(id,name,slug,state,status)")
    .eq("user_id", user.id).eq("status", "active");

  const memberships: Membership[] = (ms ?? []).map((m: any) => ({
    tenantId: m.tenant_id,
    role: m.role,
    tenant: Array.isArray(m.tenants) ? m.tenants[0] : m.tenants,
  })).filter((m: Membership) => m.tenant && m.tenant.status === "active");

  // active tenant: cookie → first admin membership → first staff → first of any
  const jar = await cookies();
  const want = jar.get(ACTIVE_TENANT_COOKIE)?.value;
  const active =
    memberships.find(m => m.tenantId === want) ??
    memberships.find(m => m.role === "admin") ??
    memberships.find(m => m.role === "staff") ??
    memberships[0] ?? null;

  // party type (customer/shopkeeper) inside the ACTIVE tenant — drives pricing
  let partyType: string | null = null;
  if (active?.role === "customer" && active.tenantId) {
    const { data: p } = await sb.from("parties").select("type")
      .eq("user_id", user.id).eq("tenant_id", active.tenantId).limit(1);
    partyType = p?.[0]?.type ?? null;
  }

  return {
    userId: user.id,
    name: prof.name,
    mobile: prof.mobile,
    isSuper: prof.role === "superadmin",
    memberships,
    tenantId: active?.tenantId ?? null,
    role: active?.role ?? null,
    tenant: active?.tenant ?? null,
    partyType,
    trade: partyType === "shopkeeper",
  };
}

/* ---------------- guards ---------------- */

export async function requireSession() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Admin or staff of the ACTIVE tenant — for ERP pages. */
export async function requireStaff() {
  const s = await requireSession();
  if (s.role !== "admin" && s.role !== "staff") redirect("/portfolio");
  return s;
}

/** Customer of the ACTIVE tenant — for account pages. */
export async function requireCustomer() {
  const s = await requireSession();
  if (s.role !== "customer") redirect("/portfolio");
  return s;
}

/** Platform owner (profile-level role, tenant-independent). */
export async function requireSuper() {
  const s = await requireSession();
  if (!s.isSuper) redirect("/portfolio");
  return s;
}