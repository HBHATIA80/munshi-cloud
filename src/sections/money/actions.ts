"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import { pad } from "@/lib/books";

type Res = { error?: string; ok?: boolean; no?: string };

/** FIFO-allocate `amount` across a party's unpaid sale invoices; returns allocations + unapplied */
async function fifoAllocate(sb: any, partyId: string, amount: number) {
  const { data: open } = await sb.from("vouchers")
    .select("id,no,total,paid,date").eq("type", "sale").eq("party_id", partyId)
    .order("date", { ascending: true });
  let rem = amount;
  const alloc: { inv_id: string; no: string; amount: number }[] = [];
  for (const inv of open ?? []) {
    const due = inv.total - inv.paid;
    if (rem <= 0 || due <= 0) continue;
    const a = Math.round(Math.min(rem, due) * 100) / 100;
    await sb.from("vouchers").update({ paid: Math.round((inv.paid + a) * 100) / 100 }).eq("id", inv.id);
    alloc.push({ inv_id: inv.id, no: inv.no, amount: a });
    rem = Math.round((rem - a) * 100) / 100;
  }
  return { alloc, unapplied: rem };
}

/** reverse a receipt's stored allocations from the invoices */
async function reverseAlloc(sb: any, alloc: { inv_id: string; amount: number }[]) {
  for (const a of alloc) {
    const { data: inv } = await sb.from("vouchers").select("paid").eq("id", a.inv_id).single();
    if (inv) await sb.from("vouchers")
      .update({ paid: Math.max(0, Math.round((inv.paid - a.amount) * 100) / 100) })
      .eq("id", a.inv_id);
  }
}

export async function saveMoneyAction(fd: FormData): Promise<Res> {
  const s = await requireStaff();
  const sb = await createClient();
  if (!s.tenantId) return { error: "No tenant on session." };
  try {
    const type = String(fd.get("type"));
    const partyId = String(fd.get("party_id") || "");
    const amount = +String(fd.get("amount") || 0);
    if (!partyId) return { error: "Pick a party." };
    if (!(amount > 0)) return { error: "Enter an amount." };
    const mode = String(fd.get("mode") || "cash");
    const date = String(fd.get("date") || "") || new Date().toISOString().slice(0, 10);

    let alloc: { inv_id: string; no: string; amount: number }[] = [];
    let unapplied = 0;
    let narr = String(fd.get("narr") || "");

    if (type === "receipt") {
      const r = await fifoAllocate(sb, partyId, amount);
      alloc = r.alloc; unapplied = r.unapplied;
      narr = (narr ? narr + " · " : "")
        + (alloc.length ? "adjusted: " + alloc.map(a => a.no).join(", ") : "on account")
        + (unapplied > 0 ? ` · advance ₹${unapplied.toFixed(0)}` : "");
    }

    const { data: seq, error: eSeq } = await sb.rpc("next_voucher",
      { p_tenant: s.tenantId, p_kind: type });
    if (eSeq) return { error: eSeq.message };
    const no = (type === "receipt" ? "RCP-" : "PAY-") + pad(Number(seq));
    const { error: eIns } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId,
      no, type, date, party_id: partyId, is_gst: false, taxable: 0, tax: 0,
      total: Math.round(amount * 100) / 100, paid: 0, mode, narr, lines: [],
      alloc: type === "receipt" ? alloc : [],
    });
    if (eIns) return { error: eIns.message };
    revalidatePath("/erp/ledger"); revalidatePath("/erp"); revalidatePath("/erp/sales");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= EDIT RECEIPT / PAYMENT (re-runs FIFO) ================= */
export async function updateMoneyVoucherAction(fd: FormData): Promise<Res> {
  const s = await requireStaff();
  const sb = await createClient();
  if (!s.tenantId) return { error: "No tenant on session." };
  const id = String(fd.get("id") || "");
  const amount = +String(fd.get("amount") || 0);
  if (!(amount > 0)) return { error: "Enter a valid amount." };
  try {
    const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
    if (!v) return { error: "Voucher not found." };
    const newAmt = Math.round(amount * 100) / 100;
    const oldAmt = +v.total;
    let narr = String(fd.get("narr") || v.narr || "");

    if (v.type === "receipt") {
      // reverse old FIFO allocations, then re-run with the new amount
      await reverseAlloc(sb, (v.alloc ?? []) as any);
      const { alloc, unapplied } = await fifoAllocate(sb, v.party_id, newAmt);
      narr = (narr.split(" · ")[0] ? narr.split(" · ")[0] + " · " : "")
        + (alloc.length ? "adjusted: " + alloc.map(a => a.no).join(", ") : "on account")
        + (unapplied > 0 ? ` · advance ₹${unapplied.toFixed(0)}` : "");
      await sb.from("vouchers").update({
        total: newAmt, mode: String(fd.get("mode") || v.mode),
        date: String(fd.get("date") || v.date), narr, alloc,
      }).eq("id", id);
    } else {
      await sb.from("vouchers").update({
        total: newAmt, mode: String(fd.get("mode") || v.mode),
        date: String(fd.get("date") || v.date), narr,
      }).eq("id", id);
    }
    revalidatePath("/erp/ledger"); revalidatePath("/erp");
    return { ok: true, no: v.no };
  } catch (e: any) { return { error: e.message }; }
}