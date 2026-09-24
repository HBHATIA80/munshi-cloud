import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PartyJournal } from "@/sections/money/PartyJournal";

export default async function JournalPage() {
  await requireStaff();
  const sb = await createClient();
  const [{ data: parties }, { data: jnls }] = await Promise.all([
    sb.from("parties").select("id,name,type").order("name"),
    sb.from("vouchers")
      .select("id,no,date,party_id,total,narr")
      .eq("type", "journal")
      .order("date", { ascending: false }),
  ]);

  const legs = (jnls ?? []) as {
    id: string; no: string; date: string; party_id: string | null;
    total: number; narr: string | null;
  }[];
  const transfers = Math.ceil(legs.length / 2);

  return (
    <>
      <p className="mut" style={{ fontSize: 12, margin: "0 0 10px" }}>
        {transfers} transfer{transfers === 1 ? "" : "s"} · {legs.length} journal leg{legs.length === 1 ? "" : "s"}
      </p>
      <PartyJournal
        parties={(parties ?? []) as { id: string; name: string; type: string }[]}
        history={legs}
      />
    </>
  );
}