import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth";
import type { Voucher, Party } from "@/lib/books";

export function ordChip(s: string) {
  const cls = s === "delivered" ? "grn" : s === "cancelled" ? "red" : s === "confirmed" ? "blu" : "amb";
  return <span className={"chip " + cls}>{s}</span>;
}

/** shared data loader for ledger-ish pages */
export async function myBooks() {
  const s = await requireCustomer();
  const sb = await createClient();
  const { data: p } = await sb.from("parties").select("*").eq("user_id", s.userId).limit(1);
  const party = (p ?? [])[0] as Party | undefined;
  const { data: vs } = party
    ? await sb.from("vouchers").select("*").eq("party_id", party.id).order("date")
    : { data: [] };
  return { s, party, vs: (vs ?? []) as unknown as Voucher[] };
}