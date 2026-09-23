import { createClient } from "@/lib/supabase/server";
import { CompatSearch } from "./CompatSearch";

export async function CompatSection() {
  const sb = await createClient();
  const [{ data: pts }, { data: models }, { data: groups }, { data: members }] = await Promise.all([
    sb.from("part_types").select("id,name,emoji,sort").order("sort"),
    sb.from("phone_models").select("id,brand,name"),
    sb.from("compat_groups").select("id,part_type_id,note"),
    sb.from("compat_members").select("group_id,model_id"),
  ]);

  const ptMap = new Map((pts ?? []).map((p: any) => [p.id, p]));
  const mMap = new Map((models ?? []).map((m: any) => [m.id, m]));
  const gById = new Map((groups ?? []).map((g: any) => [g.id, g]));

  type Sug = { gid: string; mid: string; label: string; sub: string };
  const sugs: Sug[] = [];
  for (const m of (members ?? []) as any[]) {
    const g = gById.get(m.group_id);
    const mod = mMap.get(m.model_id);
    const pt = g ? ptMap.get(g.part_type_id) : null;
    if (!g || !mod || !pt) continue;
    sugs.push({
      gid: g.id, mid: mod.id,
      label: `${mod.brand} ${mod.name}`,
      sub: `${pt.emoji} ${pt.name}${g.note ? " · " + g.note : ""}`,
    });
  }
  sugs.sort((a, b) => a.label.localeCompare(b.label) || a.sub.localeCompare(b.sub));

  const seen = new Set<string>();
  const chips = sugs.filter(s => {
    if (seen.has(s.label)) return false;
    seen.add(s.label); return true;
  }).slice(0, 6);

  return (
    <>
      <CompatSearch sugs={sugs} big />
      {chips.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap",
          justifyContent: "center", marginTop: 12 }}>
          <span className="mut" style={{ fontSize: 12, alignSelf: "center" }}>Popular:</span>
          {chips.map(c => (
            <a key={c.gid + c.mid} href={`/compat?g=${c.gid}&m=${c.mid}`}
              className="chip" style={{ fontSize: 12.5, padding: "6px 12px",
                textDecoration: "none" }}>{c.label}</a>
          ))}
        </div>)}
    </>
  );
}