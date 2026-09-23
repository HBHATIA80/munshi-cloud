"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";

type Res = { error?: string; ok?: boolean; id?: string };

/* Super-admin gate. NOTE: reads s.role — if your session uses a different
   field name or role value, adjust the list below (error will tell you). */
async function requireSuperAdmin() {
  const s = await requireStaff();
  const role = String((s as any).role ?? "").toLowerCase();
  if (!["super", "super_admin", "superadmin", "admin", "owner"].includes(role))
    throw new Error("Super admin access required.");
  return s;
}

export async function upsertModelAction(brand: string, name: string): Promise<Res> {
  await requireSuperAdmin();
  const sb = await createClient();
  brand = brand.trim(); name = name.trim();
  if (!brand || !name) return { error: "Brand and model name are required." };
  const { data } = await sb.from("phone_models")
    .select("id").eq("brand", brand).eq("name", name).maybeSingle();
  if (data) return { ok: true, id: data.id };
  const { data: ins, error } = await sb.from("phone_models")
    .insert({ brand, name }).select("id").single();
  if (error) return { error: error.message };
  return { ok: true, id: ins.id };
}

export async function saveCompatGroupAction(partTypeId: string, modelIds: string[],
  itemId: string, note: string, groupId?: string): Promise<Res> {
  await requireSuperAdmin();
  const sb = await createClient();
  if (!partTypeId) return { error: "Pick a part type." };
  if (modelIds.length < 2) return { error: "Add at least two models that share this part." };
  try {
    let gid = groupId ?? "";
    if (gid) {
      const { error } = await sb.from("compat_groups").update({
        part_type_id: partTypeId, item_id: itemId || null, note: note || null,
      }).eq("id", gid);
      if (error) return { error: error.message };
      const { error: eD } = await sb.from("compat_members").delete().eq("group_id", gid);
      if (eD) return { error: eD.message };
    } else {
      const { data: g, error } = await sb.from("compat_groups").insert({
        part_type_id: partTypeId, item_id: itemId || null, note: note || null,
      }).select("id").single();
      if (error) return { error: error.message };
      gid = g.id;
    }
    const { error: eM } = await sb.from("compat_members")
      .insert(modelIds.map(id => ({ group_id: gid, model_id: id })));
    if (eM) return { error: eM.message };
    revalidatePath("/", "layout");
    return { ok: true, id: gid };
  } catch (e: any) { return { error: e.message }; }
}

export async function deleteCompatGroupAction(id: string): Promise<Res> {
  await requireSuperAdmin();
  const sb = await createClient();
  const { error } = await sb.from("compat_groups").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}