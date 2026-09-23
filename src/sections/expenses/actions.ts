"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";

export async function saveExpenseAction(fd: FormData) {
  const s = await requireStaff();
  const sb = await createClient();
  if (!s.tenantId) throw new Error("No tenant on session.");
  const head = String(fd.get("head") || "").trim();
  const amount = +String(fd.get("amount") || 0);
  if (!head || !(amount > 0)) throw new Error("Head and a positive amount are required.");
  const { error } = await sb.from("expenses").insert({
    tenant_id: s.tenantId,
    head, amount, mode: String(fd.get("mode") || "cash"),
    date: String(fd.get("date") || "") || new Date().toISOString().slice(0, 10),
    narr: String(fd.get("narr") || ""),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/erp/expenses"); revalidatePath("/erp/reports");
}

export async function deleteExpenseAction(id: string) {
  const s = await requireStaff();
  const sb = await createClient();
  const { error } = await sb.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/erp/expenses");
}