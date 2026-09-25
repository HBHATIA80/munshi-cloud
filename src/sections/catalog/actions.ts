"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { customerCap } from "@/lib/plans";

type Res = { error?: string; ok?: boolean; id?: string; added?: number };

/* ---------- helpers ---------- */
async function staffAndTenant() {
  const s = await requireStaff();
  const sb = await createClient();
  return { s, sb };
}

async function uploadImage(dataUrl: string, tenantId: string): Promise<string> {
  const sb = await createClient();
  const base64 = dataUrl.split(",")[1];
  const buf = Buffer.from(base64, "base64");
  const path = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.jpg`;
  const { error } = await sb.storage.from("products").upload(path, buf, { contentType: "image/jpeg" });
  if (error) throw new Error("Image upload failed: " + error.message);
  const { data } = sb.storage.from("products").getPublicUrl(path);
  return data.publicUrl;
}

/** true if another item in this tenant has the same name + category + sub + brand (case-insensitive) */
async function duplicateExists(sb: any, tenantId: string, name: string,
  catId: string | null, subId: string | null, brandId: string | null, excludeId?: string) {
  let q = sb.from("items").select("id,name")
    .eq("tenant_id", tenantId)
    .ilike("name", name);          // case-insensitive name match
  q = catId ? q.eq("cat_id", catId) : q.is("cat_id", null);
  q = subId ? q.eq("sub_id", subId) : q.is("sub_id", null);
  q = brandId ? q.eq("brand_id", brandId) : q.is("brand_id", null);
  if (excludeId) q = q.neq("id", excludeId);   // on edit, ignore the item itself
  const { data } = await q.limit(1);
  return !!(data && data.length);
}

const dupErr = (e: any, label: string) =>
  e?.code === "23505" || /duplicate|unique/i.test(e?.message ?? "")
    ? `${label} already exists (names are unique regardless of capitals).`
    : e?.message ?? "Save failed.";

/* ================= ITEMS ================= */
export async function saveItemAction(fd: FormData) {
  const { s, sb } = await staffAndTenant();
  if (!s.tenantId) throw new Error("No tenant");
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const id = g("id");
  const name = g("name");
  const catId = g("cat_id") || null;
  const subId = g("sub_id") || null;
  const brandId = g("brand_id") || null;
  if (!name) throw new Error("Item name is required.");

  // duplicate guard: same name + category + sub-category + brand in this shop (caps ignored)
  if (await duplicateExists(sb, s.tenantId, name, catId, subId, brandId, id || undefined))
    throw new Error(`"${name}" already exists with this category, sub-category and brand. ` +
      `Edit the existing item instead, or change the name/category to make it distinct.`);

  const img = g("image");
  let image_url: string | undefined;
  if (img.startsWith("data:image")) image_url = await uploadImage(img, s.tenantId);

  const vals: Record<string, unknown> = {
    name, sku: g("sku"), unit: g("unit") || "pc",
    cat_id: catId, sub_id: subId, brand_id: brandId,
    hsn: g("hsn"), gst: +g("gst") || 0,
    cost: +g("cost") || 0, pr: +g("pr") || 0, ps: +g("ps") || 0, mrp: +g("mrp") || 0,
    low: +g("low") || 5,
    has_serial: String(fd.get("has_serial")) === "1",   // serial-tracked item flag
  };
  if (image_url) vals.image_url = image_url;
  if (!id) vals.stock = +g("stock") || 0;

  try {
    if (id) {
      const { error } = await sb.from("items").update(vals).eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("items").insert({ ...vals, tenant_id: s.tenantId });
      if (error) throw error;
    }
  } catch (e: any) { throw new Error(dupErr(e, "Item")); }
  revalidatePath("/erp/items"); revalidatePath("/erp/cats"); revalidatePath("/shop");
}

export async function deleteItemAction(id: string) {
  const { sb } = await staffAndTenant();
  const { error } = await sb.from("items").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/items"); revalidatePath("/shop");
}

/* ================= SERIAL NUMBERS (manual add + lookup; voucher flows live in invoicing/actions.ts) ================= */
export async function addSerialsAction(fd: FormData): Promise<Res> {
  const { s } = await staffAndTenant();
  if (!s.tenantId) return { error: "No tenant on session." };
  const itemId = String(fd.get("item_id") || "");
  const raw = String(fd.get("serials") || "");
  const list = raw.split(/[\n,;\t]+/).map(x => x.trim()).filter(Boolean);
  if (!itemId || !list.length) return { error: "Pick an item and enter at least one serial." };
  const sb = await createClient();
  const { error } = await sb.from("item_serials").insert(
    list.map(serial => ({ tenant_id: s.tenantId, item_id: itemId, serial, status: "in_stock" })));
  if (error) {
    if (error.code === "23505") return { error: "Some serials already exist for this item." };
    return { error: error.message };
  }
  return { ok: true, added: list.length };
}

/** in-stock serials for a picker (sale forms) */
export async function serialsForItemAction(itemId: string) {
  const s = await requireStaff();
  const sb = await createClient();
  const { data } = await sb.from("item_serials")
    .select("id,serial,status,sale_voucher").eq("item_id", itemId)
    .eq("status", "in_stock").order("created_at");
  return data ?? [];
}

/** all serials of an item (any status) — for the item master / audit view */
export async function allSerialsForItemAction(itemId: string) {
  const s = await requireStaff();
  const sb = await createClient();
  const { data } = await sb.from("item_serials")
    .select("id,serial,status,sale_voucher,created_at").eq("item_id", itemId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/* ================= CATEGORIES (case-insensitive duplicates blocked) ================= */
export async function saveCatAction(name: string, emoji: string)
  : Promise<{ id?: string; error?: string }> {
  const { s, sb } = await staffAndTenant();
  if (!s.tenantId) return { error: "No tenant" };
  const nm = name.trim();
  if (!nm) return { error: "Category name is required." };
  // duplicate guard: same top-level category name, caps ignored
  const { data: dup } = await sb.from("categories")
    .select("id,name").eq("tenant_id", s.tenantId).is("parent_id", null)
    .ilike("name", nm).limit(1);
  if (dup?.length) return { error: `Category "${dup[0].name}" already exists (capitals don't matter).` };
  try {
    const { data, error } = await sb.from("categories")
      .insert({ name: nm, emoji: emoji || "📦", tenant_id: s.tenantId }).select("id").single();
    if (error) throw error;
    revalidatePath("/erp/cats"); revalidatePath("/shop");
    return { id: data.id };
  } catch (e: any) { return { error: dupErr(e, "Category") }; }
}

export async function saveSubAction(name: string, parentId: string)
  : Promise<{ id?: string; error?: string }> {
  const { s, sb } = await staffAndTenant();
  if (!s.tenantId) return { error: "No tenant" };
  const nm = name.trim();
  if (!nm || !parentId) return { error: "Category and sub-category name are required." };
  // duplicate guard: same name under the SAME parent, caps ignored
  const { data: dup } = await sb.from("categories")
    .select("id,name").eq("tenant_id", s.tenantId).eq("parent_id", parentId)
    .ilike("name", nm).limit(1);
  if (dup?.length) return { error: `Sub-category "${dup[0].name}" already exists under this category.` };
  try {
    const { data, error } = await sb.from("categories")
      .insert({ name: nm, parent_id: parentId, tenant_id: s.tenantId }).select("id").single();
    if (error) throw error;
    revalidatePath("/erp/cats"); revalidatePath("/shop");
    return { id: data.id };
  } catch (e: any) { return { error: dupErr(e, "Sub-category") }; }
}

export async function deleteCatAction(id: string) {
  const { sb } = await staffAndTenant();
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw new Error(error.message.includes("foreign key")
    ? "Category has items — move them first." : error.message);
  revalidatePath("/erp/cats"); revalidatePath("/shop");
}

/* ================= BRANDS (case-insensitive duplicates blocked) ================= */
export async function saveBrandAction(name: string): Promise<{ id?: string; error?: string }> {
  const { s, sb } = await staffAndTenant();
  if (!s.tenantId) return { error: "No tenant" };
  const nm = name.trim();
  if (!nm) return { error: "Brand name is required." };
  // duplicate guard: same brand name, caps ignored
  const { data: dup } = await sb.from("brands")
    .select("id,name").eq("tenant_id", s.tenantId).ilike("name", nm).limit(1);
  if (dup?.length) return { error: `Brand "${dup[0].name}" already exists (capitals don't matter).` };
  try {
    const { data, error } = await sb.from("brands")
      .insert({ name: nm, tenant_id: s.tenantId }).select("id").single();
    if (error) throw error;
    revalidatePath("/erp/cats"); revalidatePath("/erp/items"); revalidatePath("/shop");
    return { id: data.id };
  } catch (e: any) { return { error: dupErr(e, "Brand") }; }
}

export async function deleteBrandAction(id: string) {
  const { sb } = await staffAndTenant();
  const { error } = await sb.from("brands").delete().eq("id", id);
  if (error) throw new Error(error.message.includes("foreign key")
    ? "Brand has items — reassign them first." : error.message);
  revalidatePath("/erp/cats"); revalidatePath("/erp/items"); revalidatePath("/shop");
}

/* ================= USERS & ROLES ================= */
export async function reclassUserAction(userId: string, toShopkeeper: boolean) {
  const { sb } = await staffAndTenant();
  const role = toShopkeeper ? "shopkeeper" : "retailer";
  const { error: e1 } = await sb.from("profiles").update({ role }).eq("id", userId);
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.from("parties").update({ type: role }).eq("user_id", userId);
  if (e2) throw new Error(e2.message);
  revalidatePath("/erp/users");
}

export async function toggleUserAction(userId: string, currentlyActive: boolean) {
  const { sb } = await staffAndTenant();
  const { error } = await sb.from("profiles")
    .update({ status: currentlyActive ? "suspended" : "active" }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/users");
}

export async function createStaffAction(name: string, mobile: string, password: string) {
  const s = await requireStaff();
  if (s.role !== "admin") throw new Error("Only the owner can add staff.");
  if (mobile.replace(/\D/g, "").length < 10 || password.length < 6)
    throw new Error("Valid mobile and 6+ char password required.");
  const admin = createAdminClient();
  const email = mobile.replace(/\D/g, "") + "@munshi.users";
  const { error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { name, mobile, role: "staff", tenant_slug: s.tenant?.slug },
  });
  if (error) throw new Error(error.message.includes("already registered")
    ? "This mobile is already registered." : error.message);
  revalidatePath("/erp/users");
}

/* ================= PARTIES (plan cap on customers) ================= */
export async function savePartyAction(fd: FormData): Promise<{ error?: string }> {
  const { s, sb } = await staffAndTenant();
  if (!s.tenantId) return { error: "No tenant on session." };
  const g = (k: string) => String(fd.get(k) ?? "").trim();
  const id = g("id");
  const name = g("name");
  const type = g("type") || "customer";
  if (!name) return { error: "Name is required." };

  if (!id && (type === "customer" || type === "retailer")) {
    const { count } = await sb.from("parties")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", s.tenantId).in("type", ["customer", "retailer"]);
    const { data: tn } = await sb.from("tenants").select("plan").eq("id", s.tenantId).single();
    if ((count ?? 0) >= customerCap(tn?.plan))
      return { error: `Customer limit reached for the ${tn?.plan ?? "trial"} plan (${customerCap(tn?.plan)}). Upgrade the plan to add more.` };
  }

  const vals: Record<string, unknown> = {
    name, type, mobile: g("mobile"), state: g("state"), gstin: g("gstin"), addr: g("addr") };
  if (id) {
    const { data: cur } = await sb.from("parties").select("type,user_id,open").eq("id", id).single();
    if (cur?.user_id && cur.type !== type)
      return { error: "This customer is app-linked — change their role from Users & Roles instead." };
    const openVal = cur?.user_id ? (cur.open ?? 0) : (+g("open") || 0);
    const { error } = await sb.from("parties").update({ ...vals, open: openVal }).eq("id", id);
    if (error) return { error: error.message };
  } else {
    const { error } = await sb.from("parties").insert({
      ...vals, open: +g("open") || 0, tenant_id: s.tenantId });
    if (error) return { error: error.message };
  }
  revalidatePath("/erp/parties"); revalidatePath("/erp/ledger");
  return {};
}

export async function deletePartyAction(id: string): Promise<{ error?: string }> {
  const { sb } = await staffAndTenant();
  const { data: p } = await sb.from("parties").select("user_id").eq("id", id).single();
  if (p?.user_id) return { error: "This is an app-linked customer — suspend them from Users & Roles instead." };
  const { error } = await sb.from("parties").delete().eq("id", id);
  if (error) return { error: error.message.includes("foreign key")
    ? "Party has transactions — they must stay in the books." : error.message };
  revalidatePath("/erp/parties");
  return {};
}