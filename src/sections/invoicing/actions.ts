"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireStaff, requireCustomer } from "@/lib/auth";
import { pad, type VLine } from "@/lib/books";

type Res = { error?: string; ok?: boolean; no?: string };

async function staff() {
  const s = await requireStaff();
  const sb = await createClient();
  return { s, sb };
}

/* ---------- FIFO helpers (receipt allocation across unpaid invoices) ---------- */
async function fifoAllocate(sb: any, partyId: string, amount: number) {
  const { data: open } = await sb.from("vouchers")
    .select("id,no,total,paid,date").eq("type", "sale").eq("party_id", partyId)
    .order("date", { ascending: true });
  let rem = Math.round(amount * 100) / 100;
  const alloc: { inv_id: string; no: string; amount: number }[] = [];
  for (const inv of open ?? []) {
    const due = Math.round((inv.total - inv.paid) * 100) / 100;
    if (rem <= 0 || due <= 0) continue;
    const a = Math.round(Math.min(rem, due) * 100) / 100;
    await sb.from("vouchers").update({ paid: Math.round((inv.paid + a) * 100) / 100 }).eq("id", inv.id);
    alloc.push({ inv_id: inv.id, no: inv.no, amount: a });
    rem = Math.round((rem - a) * 100) / 100;
  }
  return { alloc, unapplied: rem };
}

async function reverseAlloc(sb: any, alloc: { inv_id: string; amount: number }[]) {
  for (const a of alloc) {
    const { data: inv } = await sb.from("vouchers").select("paid").eq("id", a.inv_id).single();
    if (inv) await sb.from("vouchers")
      .update({ paid: Math.max(0, Math.round((inv.paid - a.amount) * 100) / 100) })
      .eq("id", a.inv_id);
  }
}

/* ================= SALES (paid amount + mode; auto receipt; serial tracking) ================= */
export async function saveSaleAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  try {
    const lines: VLine[] = JSON.parse(String(fd.get("lines") || "[]"));
    const valid = lines.filter(l => l.item_id && l.qty >= 0 && l.rate >= 0 && l.name);
    if (!valid.length) return { error: "Add at least one valid line." };
    const partyId = String(fd.get("party_id") || "") || null;
    const isGst = String(fd.get("is_gst")) === "1";
    const billDisc = Math.max(0, +String(fd.get("bill_disc") || 0));
    const date = String(fd.get("date") || "") || new Date().toISOString().slice(0, 10);
    const paid = Math.max(0, +String(fd.get("paid") || 0) || 0);
    const payMode = String(fd.get("pay_mode") || "cash");

    // serial pre-validation BEFORE anything is written
    for (const l of valid) {
      const ser = ((l as any).serials as string[] | undefined)?.map((x: string) => x.trim()).filter(Boolean);
      if (ser?.length) {
        if (ser.length !== l.qty)
          return { error: `${l.name}: ${l.qty} qty needs exactly ${l.qty} serial(s), got ${ser.length}.` };
        const { data: owned } = await sb.from("item_serials")
          .select("serial").eq("item_id", l.item_id!).eq("status", "in_stock");
        const have = new Set((owned ?? []).map((r: any) => r.serial));
        const missing = ser.filter(x => !have.has(x));
        if (missing.length)
          return { error: `${l.name}: serial(s) not in stock — ${missing.join(", ")}` };
      }
    }

    const { data: itemsAll } = await sb.from("items")
      .select("id,stock,cost,name,unit,hsn,gst,pr,ps");
    const sm: Record<string, any> = {};
    for (const it of itemsAll ?? []) sm[it.id] = it;

    let taxable = 0, tax = 0;
    for (const l of valid) {
      l._net = Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;
      l._tax = isGst ? Math.round(l._net * l.gst / 100 * 100) / 100 : 0;
      taxable += l._net; tax += l._tax;
    }
    taxable = Math.round(taxable * 100) / 100;
    const bd = Math.min(billDisc, taxable);
    const netT = Math.round((taxable - bd) * 100) / 100;
    tax = Math.round(tax * (taxable ? netT / taxable : 0) * 100) / 100;
    const total = Math.round(netT + tax);
    const paidAmt = partyId ? Math.max(0, Math.min(paid, total)) : total;  // counter sale = always full
    const mode = paidAmt >= total ? payMode : "credit";

    const { data: seq, error: eSeq } = await sb.rpc("next_voucher",
      { p_tenant: s.tenantId, p_kind: "sale" });
    if (eSeq) return { error: eSeq.message };
    const no = "INV-" + pad(Number(seq));

    const { error: eIns } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId,
      no, type: "sale", date, party_id: partyId, is_gst: isGst,
      taxable: netT, tax, total, paid: paidAmt,
      mode, lines: valid, narr: String(fd.get("narr") || ""), ref: String(fd.get("ref") || ""),
    });
    if (eIns) return { error: eIns.message };

    for (const l of valid) {
      const it = sm[l.item_id!];
      await sb.from("items").update({ stock: (it?.stock ?? 0) - l.qty }).eq("id", l.item_id!);
    }

    // mark sold serials, stamped with this invoice no (audit: release/edit scoped by sale_voucher)
    for (const l of valid) {
      const ser = ((l as any).serials as string[] | undefined)?.map((x: string) => x.trim()).filter(Boolean);
      if (ser?.length) {
        const { error: eS } = await sb.from("item_serials")
          .update({ status: "sold", sale_voucher: no })
          .eq("item_id", l.item_id!).eq("status", "in_stock").in("serial", ser);
        if (eS) return { error: "Serial update failed: " + eS.message };
      }
    }

    // money received at invoice time posts its own receipt voucher
    if (partyId && paidAmt > 0) {
      const { data: rseq, error: rErr } = await sb.rpc("next_voucher",
        { p_tenant: s.tenantId, p_kind: "receipt" });
      if (!rErr) {
        await sb.from("vouchers").insert({
          tenant_id: s.tenantId,
          no: "RCP-" + pad(Number(rseq)), type: "receipt", date,
          party_id: partyId, is_gst: false, taxable: 0, tax: 0,
          total: paidAmt, paid: 0, mode: payMode,
          narr: `Received with invoice ${no}`, lines: [],
        });
      }
    }
    revalidatePath("/erp/sales"); revalidatePath("/erp"); revalidatePath("/shop");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= PURCHASE (paid amount + mode; auto payment; serial capture) ================= */
export async function savePurchaseAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  try {
    const lines: VLine[] = JSON.parse(String(fd.get("lines") || "[]"));
    const valid = lines.filter(l => l.item_id && l.qty > 0 && l.rate >= 0);
    if (!valid.length) return { error: "Add at least one valid line." };
    const partyId = String(fd.get("party_id") || "") || null;
    const date = String(fd.get("date") || "") || new Date().toISOString().slice(0, 10);
    const paidNow = String(fd.get("mode")) === "paid";
    const isGst = String(fd.get("is_gst") || "1") === "1";
    const paid = Math.max(0, +String(fd.get("paid") || 0) || 0);
    const payMode = String(fd.get("pay_mode") || "cash");

    // serial pre-validation: count must match qty
    for (const l of valid) {
      const ser = ((l as any).serials as string[] | undefined)?.map((x: string) => x.trim()).filter(Boolean);
      if (ser?.length && ser.length !== l.qty)
        return { error: `${l.name}: ${l.qty} qty needs exactly ${l.qty} serial(s), got ${ser.length}.` };
    }

    let taxable = 0, tax = 0;
    for (const l of valid) {
      l._net = Math.round(l.qty * l.rate * 100) / 100;
      l._tax = isGst ? Math.round(l._net * l.gst / 100 * 100) / 100 : 0;
      taxable += l._net; tax += l._tax;
    }
    const total = Math.round(isGst ? taxable + tax : taxable);
    const paidAmt = paidNow ? total : Math.max(0, Math.min(paid, total));
    const mode = paidAmt >= total ? payMode : "credit";

    const { data: seq, error: eSeq } = await sb.rpc("next_voucher",
      { p_tenant: s.tenantId, p_kind: "purchase" });
    if (eSeq) return { error: eSeq.message };
    const no = "PUR-" + pad(Number(seq));
    const { error: eIns } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId,
      no, type: "purchase", date, party_id: partyId,
      is_gst: isGst, taxable: Math.round(taxable * 100) / 100,
      tax: isGst ? Math.round(tax * 100) / 100 : 0,
      total, paid: paidAmt, mode,
      lines: valid, ref: String(fd.get("ref") || ""), narr: String(fd.get("narr") || ""),
    });
    if (eIns) return { error: eIns.message };

    for (const l of valid) {
      const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
      await sb.from("items").update({ stock: (it?.stock ?? 0) + l.qty, cost: l.rate })
        .eq("id", l.item_id!);
    }

    // insert serials for this bill (count already validated above)
    for (const l of valid) {
      const ser = ((l as any).serials as string[] | undefined)?.map((x: string) => x.trim()).filter(Boolean);
      if (ser?.length) {
        const { error: eS } = await sb.from("item_serials").insert(
          ser.map((serial: string) => ({
            tenant_id: s.tenantId, item_id: l.item_id!, serial, status: "in_stock",
          })));
        if (eS) {
          if (eS.code === "23505")
            return { error: `${l.name}: one or more serials already exist for this item.` };
          return { error: "Serial save failed: " + eS.message };
        }
      }
    }

    if (partyId && paidAmt > 0) {
      const { data: pseq, error: pErr } = await sb.rpc("next_voucher",
        { p_tenant: s.tenantId, p_kind: "payment" });
      if (!pErr) {
        await sb.from("vouchers").insert({
          tenant_id: s.tenantId,
          no: "PAY-" + pad(Number(pseq)), type: "payment", date,
          party_id: partyId, is_gst: false, taxable: 0, tax: 0,
          total: paidAmt, paid: 0, mode: payMode,
          narr: `Paid with bill ${no}`, lines: [],
        });
      }
    }
    revalidatePath("/erp/purchreg"); revalidatePath("/erp"); revalidatePath("/shop");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= EDIT SALE (full update, same voucher no; serials re-scoped) ================= */
export async function updateSaleAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  try {
    const id = String(fd.get("id") || "");
    if (!id) return { error: "Missing voucher id." };
    const { data: old } = await sb.from("vouchers").select("*").eq("id", id).single();
    if (!old || old.type !== "sale") return { error: "Voucher not found." };

    const lines: VLine[] = JSON.parse(String(fd.get("lines") || "[]"));
    const valid = lines.filter(l => l.item_id && l.qty >= 0 && l.rate >= 0 && l.name);
    if (!valid.length) return { error: "Add at least one valid line." };
    const partyId = String(fd.get("party_id") || "") || null;
    const isGst = String(fd.get("is_gst")) === "1";
    const billDisc = Math.max(0, +String(fd.get("bill_disc") || 0));
    const date = String(fd.get("date") || "") || old.date;

    // validate new serial set BEFORE writing anything
    const newSerials: { itemId: string; list: string[] }[] = [];
    for (const l of valid) {
      const ser = ((l as any).serials as string[] | undefined)?.map((x: string) => x.trim()).filter(Boolean);
      if (ser?.length) {
        if (ser.length !== l.qty)
          return { error: `${l.name}: ${l.qty} qty needs exactly ${l.qty} serial(s), got ${ser.length}.` };
        newSerials.push({ itemId: l.item_id!, list: ser });
      }
    }

    // reverse the OLD stock effects
    for (const l of (old.lines as VLine[]) ?? []) {
      const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
      if (it) await sb.from("items").update({ stock: it.stock + l.qty }).eq("id", l.item_id!);
    }

    let taxable = 0, tax = 0;
    for (const l of valid) {
      l._net = Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;
      l._tax = isGst ? Math.round(l._net * l.gst / 100 * 100) / 100 : 0;
      taxable += l._net; tax += l._tax;
    }
    taxable = Math.round(taxable * 100) / 100;
    const bd = Math.min(billDisc, taxable);
    const netT = Math.round((taxable - bd) * 100) / 100;
    tax = Math.round(tax * (taxable ? netT / taxable : 0) * 100) / 100;
    const total = Math.round(netT + tax);
    const paid = Math.max(0, Math.min(+String(fd.get("paid") || (old.paid ?? 0)) || 0, total));

    const { error: eUpd } = await sb.from("vouchers").update({
      date, party_id: partyId, is_gst: isGst,
      taxable: netT, tax, total, paid,
      lines: valid, narr: String(fd.get("narr") || ""), ref: String(fd.get("ref") || ""),
    }).eq("id", id);
    if (eUpd) return { error: eUpd.message };

    const { data: itemsAll } = await sb.from("items").select("id,stock");
    const sm: Record<string, number> = {};
    for (const it of itemsAll ?? []) sm[it.id] = it.stock;
    for (const l of valid) {
      await sb.from("items").update({ stock: (sm[l.item_id!] ?? 0) - l.qty }).eq("id", l.item_id!);
    }

    // serials: release everything previously sold on THIS invoice, re-mark from edited lines
    if (old.no) {
      await sb.from("item_serials")
        .update({ status: "in_stock", sale_voucher: null })
        .eq("sale_voucher", old.no).eq("status", "sold");
    }
    for (const ns of newSerials) {
      const { error: eS } = await sb.from("item_serials")
        .update({ status: "sold", sale_voucher: old.no })
        .eq("item_id", ns.itemId).eq("status", "in_stock").in("serial", ns.list);
      if (eS) return { error: "Serial update failed: " + eS.message };
    }

    revalidatePath("/erp/sales"); revalidatePath("/erp"); revalidatePath("/shop");
    return { ok: true, no: old.no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= EDIT PURCHASE (full update, same voucher no) ================= */
export async function updatePurchaseAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  try {
    const id = String(fd.get("id") || "");
    if (!id) return { error: "Missing voucher id." };
    const { data: old } = await sb.from("vouchers").select("*").eq("id", id).single();
    if (!old || old.type !== "purchase") return { error: "Voucher not found." };

    const lines: VLine[] = JSON.parse(String(fd.get("lines") || "[]"));
    const valid = lines.filter(l => l.item_id && l.qty > 0 && l.rate >= 0 && l.name);
    if (!valid.length) return { error: "Add at least one valid line." };
    const partyId = String(fd.get("party_id") || "") || null;
    const isGst = String(fd.get("is_gst")) === "1";
    const date = String(fd.get("date") || "") || old.date;

    for (const l of (old.lines as VLine[]) ?? []) {
      const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
      if (it) await sb.from("items").update({ stock: Math.max(0, it.stock - l.qty) })
        .eq("id", l.item_id!);
    }

    let taxable = 0, tax = 0;
    for (const l of valid) {
      l._net = Math.round(l.qty * l.rate * 100) / 100;
      l._tax = isGst ? Math.round(l._net * l.gst / 100 * 100) / 100 : 0;
      taxable += l._net; tax += l._tax;
    }
    const total = Math.round(isGst ? taxable + tax : taxable);
    const paid = Math.max(0, Math.min(+String(fd.get("paid") || (old.paid ?? 0)) || 0, total));

    const { error: eUpd } = await sb.from("vouchers").update({
      date, party_id: partyId, is_gst: isGst,
      taxable: Math.round(taxable * 100) / 100,
      tax: isGst ? Math.round(tax * 100) / 100 : 0,
      total, paid,
      lines: valid, narr: String(fd.get("narr") || ""), ref: String(fd.get("ref") || ""),
    }).eq("id", id);
    if (eUpd) return { error: eUpd.message };

    for (const l of valid) {
      const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
      await sb.from("items").update({ stock: (it?.stock ?? 0) + l.qty, cost: l.rate })
        .eq("id", l.item_id!);
    }
    revalidatePath("/erp/purchreg"); revalidatePath("/erp"); revalidatePath("/shop");
    return { ok: true, no: old.no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= RETURNS ================= */
export async function postReturnAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  try {
    const kind = String(fd.get("kind")); // salret | purret
    const srcId = String(fd.get("src_id") || "");
    const qtys: Record<string, number> = JSON.parse(String(fd.get("qtys") || "{}"));
    const { data: src } = await sb.from("vouchers").select("*").eq("id", srcId).single();
    if (!src) return { error: "Original document not found." };
    const lines: VLine[] = (src.lines as VLine[])
      .filter(l => (qtys[l.item_id!] ?? 0) > 0 && (qtys[l.item_id!] ?? 0) <= l.qty)
      .map(l => ({ ...l, qty: qtys[l.item_id!] }));
    if (!lines.length) return { error: "Enter return quantities." };
    const taxable = Math.round(lines.reduce((t, l) => t + l.qty * l.rate * (1 - (l.disc || 0) / 100), 0) * 100) / 100;
    const tax = src.is_gst ? Math.round(lines.reduce((t, l) => t + l.qty * l.rate * (1 - (l.disc || 0) / 100) * l.gst / 100, 0) * 100) / 100 : 0;
    const { data: seq, error: eSeq } = await sb.rpc("next_voucher",
      { p_tenant: s.tenantId, p_kind: kind });
    if (eSeq) return { error: eSeq.message };
    const no = (kind === "salret" ? "CRN-" : "DBN-") + pad(Number(seq));
    const { error: eIns } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId,
      no, type: kind, date: new Date().toISOString().slice(0, 10), party_id: src.party_id,
      is_gst: src.is_gst, taxable, tax, total: Math.round(taxable + tax), paid: 0,
      mode: "adjust", lines, narr: "Against " + src.no,
    });
    if (eIns) return { error: eIns.message };
    for (const l of lines) {
      const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
      const next = kind === "salret" ? (it?.stock ?? 0) + l.qty : Math.max(0, (it?.stock ?? 0) - l.qty);
      await sb.from("items").update({ stock: next }).eq("id", l.item_id!);
    }
    revalidatePath("/erp/returns"); revalidatePath("/erp");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= DELETE VOUCHER (reverses stock, FIFO, serials; journals delete as pair) ================= */
export async function deleteVoucherAction(id: string): Promise<Res> {
  const { sb } = await staff();
  try {
    const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
    if (!v) return { error: "Not found." };

    let pairIds: string[] = [];
    if (v.type === "journal" && v.ref) {
      const { data: sib } = await sb.from("vouchers")
        .select("id").eq("type", "journal").eq("ref", v.ref).neq("id", id);
      pairIds = (sib ?? []).map(r => r.id);
    }

    if (v.type === "sale") {
      for (const l of (v.lines ?? []) as VLine[]) {
        const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
        if (it) await sb.from("items").update({ stock: it.stock + l.qty }).eq("id", l.item_id!);
      }
      if (v.no) {
        // serials sold on this invoice return to stock
        await sb.from("item_serials")
          .update({ status: "in_stock", sale_voucher: null })
          .eq("sale_voucher", v.no).eq("status", "sold");
      }
    }
    if (v.type === "purchase") {
      for (const l of (v.lines ?? []) as VLine[]) {
        const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
        if (it) await sb.from("items").update({ stock: Math.max(0, it.stock - l.qty) })
          .eq("id", l.item_id!);
      }
      // serials captured with this bill: remove only those still in stock
      const purSerials = ((v.lines ?? []) as any[]).flatMap(l => (l.serials as string[] | undefined) ?? []);
      if (purSerials.length) {
        await sb.from("item_serials").delete()
          .in("serial", purSerials).eq("status", "in_stock");
      }
    }
    if (v.type === "receipt" && Array.isArray(v.alloc))
      for (const a of v.alloc) {
        const { data: inv } = await sb.from("vouchers").select("paid").eq("id", a.inv_id).single();
        if (inv) await sb.from("vouchers")
          .update({ paid: Math.max(0, Math.round((inv.paid - a.amount) * 100) / 100) })
          .eq("id", a.inv_id);
      }

    const { error } = await sb.from("vouchers").delete().in("id", [id, ...pairIds]);
    if (error) return { error: error.message };
    revalidatePath("/erp/ledger"); revalidatePath("/erp/sales"); revalidatePath("/erp/purchreg"); revalidatePath("/erp");
    return { ok: true };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= VOUCHER FETCH (staff, with receipt history) ================= */
export async function getVoucherAction(id: string) {
  const s = await requireStaff();
  const sb = await createClient();
  const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
  if (!v) return null;
  let party = null;
  if (v.party_id) {
    const { data } = await sb.from("parties").select("name,state,gstin,mobile").eq("id", v.party_id).single();
    party = data;
  }
  const { data: tenant } = await sb.from("tenants")
    .select("name,state,gstin,addr,phone").eq("id", s.tenantId!).single();
  let receipts: any[] = [];
  if (v.type === "sale" && v.party_id) {
    const { data: rc } = await sb.from("vouchers").select("no,type,date,total,mode,narr")
      .eq("type", "receipt").eq("party_id", v.party_id).gte("date", v.date)
      .order("date", { ascending: true });
    receipts = rc ?? [];
  }
  return { v, party, tenant, receipts };
}

/* ================= ROBUST FETCH FOR EDIT MODAL (id via FormData) ================= */
export async function fetchVoucherByIdAction(fd: FormData) {
  await requireStaff();
  const sb = await createClient();
  const id = String(fd.get("id") || "");
  if (!id) return null;
  const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
  if (!v) return null;
  const [{ data: items }, { data: parties }] = await Promise.all([
    sb.from("items").select("id,name,sku,unit,gst,cost,pr,ps,stock").order("name"),
    sb.from("parties").select("id,name,type,state").order("name"),
  ]);
  return { v, items: items ?? [], parties: parties ?? [] };
}

/* ================= SERIAL NUMBERS ================= */
export async function serialsForItemAction(itemId: string) {
  const s = await requireStaff();
  const sb = await createClient();
  const { data } = await sb.from("item_serials")
    .select("id,serial,status,sale_voucher").eq("item_id", itemId)
    .eq("status", "in_stock").order("created_at");
  return data ?? [];
}

export async function addSerialsAction(fd: FormData): Promise<Res> {
  const s = await requireStaff();
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
  return { ok: true } as any;
}

/* ================= ONLINE ORDERS ================= */
export async function setOrderStatusAction(id: string, status: string): Promise<Res> {
  const { sb } = await staff();
  const { error } = await sb.from("orders").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/erp/orders"); revalidatePath("/erp");
  return { ok: true };
}

export async function cancelOrderAction(id: string): Promise<Res> {
  const { sb } = await staff();
  try {
    const { data: o } = await sb.from("orders").select("*").eq("id", id).single();
    if (!o) return { error: "Not found." };
    for (const l of (o.lines as VLine[]) ?? []) {
      const { data: it } = await sb.from("items").select("stock").eq("id", l.item_id!).single();
      if (it) await sb.from("items").update({ stock: it.stock + l.qty }).eq("id", l.item_id!);
    }
    if (o.invoice_id) await sb.from("vouchers").delete().eq("id", o.invoice_id);
    const { error } = await sb.from("orders").update({ status: "cancelled", invoice_id: null }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/erp/orders"); revalidatePath("/erp"); revalidatePath("/shop");
    return { ok: true };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= ORDER PAYMENT DESK ================= */
export async function recordOrderPaymentAction(orderId: string, amount: number, mode: string)
  : Promise<Res> {
  const s = await requireStaff();
  const sb = await createClient();
  if (!s.tenantId) return { error: "No tenant on session." };
  if (!(amount > 0)) return { error: "Enter an amount." };
  try {
    const { data: o } = await sb.from("orders").select("no,party_id,invoice_id,total")
      .eq("id", orderId).single();
    if (!o?.party_id) return { error: "Order has no linked invoice/party." };
    const { data: inv } = await sb.from("vouchers")
      .select("id,no,total,paid").eq("id", o.invoice_id).single();
    if (!inv) return { error: "Invoice not found." };
    const due = inv.total - inv.paid;
    if (due <= 0) return { error: "This order is already fully paid." };
    const amt = Math.min(amount, due);

    const { data: seq, error: eSeq } = await sb.rpc("next_voucher",
      { p_tenant: s.tenantId, p_kind: "receipt" });
    if (eSeq) return { error: eSeq.message };
    const no = "RCP-" + pad(Number(seq));
    const { error: eIns } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId,
      no, type: "receipt", date: new Date().toISOString().slice(0, 10),
      party_id: o.party_id, is_gst: false, taxable: 0, tax: 0,
      total: Math.round(amt * 100) / 100, paid: 0, mode,
      narr: `Payment against ${o.no} (${inv.no}) - before delivery`, lines: [],
    });
    if (eIns) return { error: eIns.message };
    await sb.from("vouchers").update({ paid: Math.round((inv.paid + amt) * 100) / 100 })
      .eq("id", inv.id);
    revalidatePath("/erp/orders"); revalidatePath("/erp/sales");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= PARTY-TO-PARTY JOURNAL ================= */
/* Custom date + note from the form; note (or auto fallback) goes on BOTH legs. */
export async function partyJournalAction(fd: FormData): Promise<Res> {
  const s = await requireStaff();
  if (!s.tenantId) return { error: "No tenant on session." };
  const g = (k: string) => String(fd.get(k) || "").trim();
  const fromParty = g("from_party");
  const toParty = g("to_party");
  const amount = +g("amount");
  const d = g("date") || new Date().toISOString().slice(0, 10);
  const note = g("narr");
  if (!fromParty || !toParty || fromParty === toParty) return { error: "Pick two different parties." };
  if (!(amount > 0)) return { error: "Enter an amount." };
  const sb = await createClient();
  try {
    const { data: seq, error: eSeq } = await sb.rpc("next_voucher",
      { p_tenant: s.tenantId, p_kind: "journal" });
    if (eSeq) return { error: eSeq.message };
    const no = "JNL-" + pad(Number(seq));
    const { data: fromP } = await sb.from("parties").select("name").eq("id", fromParty).single();
    const { data: toP } = await sb.from("parties").select("name").eq("id", toParty).single();
    const narrA = note || `Party-to-party transfer: ${Math.round(amount).toLocaleString("en-IN")} moved from ${fromP?.name} to ${toP?.name}`;
    const narrB = note || `Party-to-party transfer: received from ${fromP?.name}`;
    const { error: e1 } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId, no: no + "-A", type: "journal", date: d,
      party_id: fromParty, is_gst: false, taxable: 0, tax: 0,
      total: Math.round(amount * 100) / 100, paid: 0, mode: "journal",
      narr: narrA, lines: [], ref: no,
    });
    if (e1) return { error: e1.message };
    const { error: e2 } = await sb.from("vouchers").insert({
      tenant_id: s.tenantId, no: no + "-B", type: "journal", date: d,
      party_id: toParty, is_gst: false, taxable: 0, tax: 0,
      total: Math.round(amount * 100) / 100, paid: 0, mode: "journal",
      narr: narrB, lines: [], ref: no,
    });
    if (e2) return { error: e2.message };
    revalidatePath("/erp/ledger"); revalidatePath("/erp/books"); revalidatePath("/erp/journal");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= CUSTOMER-SAFE VOUCHER FETCH (with receipt history) ================= */
export async function getMyVoucherAction(id: string) {
  const s = await requireCustomer();
  const sb = await createClient();
  const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
  if (!v) return null;
  let party = null;
  if (v.party_id) {
    const { data } = await sb.from("parties").select("name,state,gstin,mobile").eq("id", v.party_id).single();
    party = data;
  }
  const { data: tenant } = await sb.from("tenants")
    .select("name,state,gstin,addr,phone").eq("id", s.tenantId!).single();
  let receipts: any[] = [];
  if (v.type === "sale" && v.party_id) {
    const { data: rc } = await sb.from("vouchers").select("no,date,total,mode")
      .eq("type", "receipt").eq("party_id", v.party_id).gte("date", v.date)
      .order("date", { ascending: true });
    receipts = rc ?? [];
  }
  return { v, party, tenant, receipts };
}

/* ================= EDIT RECEIPT / PAYMENT (money voucher, re-runs FIFO) ================= */
/* Journal pairs: amount, date AND note sync across both legs. FIFO only for true receipts. */
export async function updateMoneyVoucherAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  const id = String(fd.get("id") || "");
  const amount = +String(fd.get("amount") || 0);
  if (!id) return { error: "Missing voucher id." };
  if (!(amount > 0)) return { error: "Enter a valid amount." };
  try {
    const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
    if (!v) return { error: "Voucher not found." };
    const newAmt = Math.round(amount * 100) / 100;
    let narr = String(fd.get("narr") || v.narr || "");
    const newDate = String(fd.get("date") || v.date);
    const newMode = String(fd.get("mode") || v.mode);

    if (v.type === "receipt") {
      await reverseAlloc(sb, (v.alloc ?? []) as any);
      const { alloc, unapplied } = await fifoAllocate(sb, v.party_id, newAmt);
      const base = narr.split("adjusted:")[0].split("on account")[0].trim();
      narr = base + " | "
        + (alloc.length ? "adjusted: " + alloc.map(a => a.no).join(", ") : "on account")
        + (unapplied > 0 ? " | advance " + unapplied.toFixed(0) : "");
      const { error } = await sb.from("vouchers").update({
        total: newAmt, mode: newMode, date: newDate, narr, alloc,
      }).eq("id", id);
      if (error) return { error: error.message };
    } else {
      const { error } = await sb.from("vouchers").update({
        total: newAmt, mode: newMode, date: newDate, narr,
      }).eq("id", id);
      if (error) return { error: error.message };
      if (v.type === "journal" && v.ref) {
        const { error: e2 } = await sb.from("vouchers").update({
          total: newAmt, date: newDate, narr,
        }).eq("type", "journal").eq("ref", v.ref).neq("id", id);
        if (e2) return { error: e2.message };
      }
    }
    revalidatePath("/erp/ledger"); revalidatePath("/erp/journal"); revalidatePath("/erp"); revalidatePath("/erp/sales");
    return { ok: true, no: v.no };
  } catch (e: any) { return { error: e.message }; }
}

/* ================= EDIT VOUCHER NUMBER (typo fix only) ================= */
export async function editNoAction(fd: FormData): Promise<Res> {
  const { s, sb } = await staff();
  if (!s.tenantId) return { error: "No tenant on session." };
  const id = String(fd.get("id") || "");
  const no = String(fd.get("no") || "").trim();
  if (!id || !no) return { error: "Missing voucher id or number." };
  try {
    const { data: dup } = await sb.from("vouchers")
      .select("id").eq("tenant_id", s.tenantId).eq("no", no).neq("id", id).maybeSingle();
    if (dup) return { error: "Another voucher already uses " + no + "." };
    const { error } = await sb.from("vouchers").update({ no }).eq("id", id);
    if (error) return { error: error.message };
    revalidatePath("/erp/sales"); revalidatePath("/erp/purchreg");
    revalidatePath("/erp/ledger"); revalidatePath("/erp/journal"); revalidatePath("/erp");
    return { ok: true, no };
  } catch (e: any) { return { error: e.message }; }
}