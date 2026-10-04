import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Voucher, Party } from "@/lib/books";

/** shared SERVER data loader for account pages — never import from client components */
export async function myBooks() {
  const s = await requireCustomer();
  const sb = await createClient();
  const { data: p } = await sb.from("parties").select("*").eq("user_id", s.userId).limit(1);
  const party = (p ?? [])[0] as Party | undefined;
  const { data: vs } = party
    ? await sb.from("vouchers").select("*")
        .eq("party_id", party.id)
        .eq("shared_with_party", true)   // opt-in only: shop decides what the customer sees
        .order("date")
    : { data: [] };
  return { s, party, vs: (vs ?? []) as unknown as Voucher[] };
}