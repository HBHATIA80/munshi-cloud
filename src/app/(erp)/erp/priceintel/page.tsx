import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PriceIntelClient } from "@/sections/invoicing/PriceIntelClient";

export default async function PriceIntelPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: items }, { data: parties }] = await Promise.all([
    sb.from("items").select("id,name,sku,cost").order("name"),
    sb.from("parties").select("id,name"),
  ]);
  const supMap = new Map((parties ?? []).map((p: any) => [p.id, p.name]));

  // last-5 purchase lines per item, from the most recent 300 purchase bills
  const { data: ps } = await sb.from("vouchers")
    .select("no,date,party_id,lines")
    .eq("type", "purchase")
    .order("date", { ascending: false })
    .limit(300);
  const allHist: Record<string, { no: string; date: string; qty: number; rate: number; supplier: string }[]> = {};
  for (const v of (ps ?? []) as any[]) {
    for (const l of (v.lines ?? []) as any[]) {
      if (!l.item_id) continue;
      const arr = allHist[l.item_id] ?? (allHist[l.item_id] = []);
      if (arr.length >= 5) continue;
      arr.push({ no: v.no, date: v.date, qty: +l.qty, rate: +l.rate,
        supplier: supMap.get(v.party_id) ?? "Cash" });
    }
  }

  // pre-open the comparison with the 6 most-recently-purchased items
  const initial = Object.entries(allHist)
    .sort(([, a], [, b]) => (b[0]?.date ?? "").localeCompare(a[0]?.date ?? ""))
    .slice(0, 6)
    .map(([id]) => id);

  return (
    <PriceIntelClient
      items={(items ?? []) as { id: string; name: string; sku: string; cost: number }[]}
      allHist={allHist}
      initial={initial}
    />
  );
}