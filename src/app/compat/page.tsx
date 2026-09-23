import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { CompatSearch } from "@/sections/compat/CompatSearch";

export const metadata: Metadata = {
  title: "Mobile part compatibility checker — MunshiCloud",
  description: "Find which displays, batteries, cameras and other spare parts fit your phone model.",
};

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

export default async function CompatPage({ searchParams }:
  { searchParams: Promise<{ g?: string; m?: string }> }) {
  const { g, m } = await searchParams;
  const sb = await createClient();
  const [{ data: pts }, { data: models }, { data: groups }, { data: members }, { data: items }] =
    await Promise.all([
      sb.from("part_types").select("id,name,emoji,sort").order("sort"),
      sb.from("phone_models").select("id,brand,name"),
      sb.from("compat_groups").select("id,part_type_id,item_id,note"),
      sb.from("compat_members").select("group_id,model_id"),
      sb.from("items").select("id,name,pr,mrp"),
    ]);

  const ptMap = new Map((pts ?? []).map((p: any) => [p.id, p]));
  const mMap = new Map((models ?? []).map((x: any) => [x.id, x]));
  const itemMap = new Map((items ?? []).map((i: any) => [i.id, i]));
  const memByG = new Map<string, string[]>();
  ((members ?? []) as any[]).forEach(x => {
    const arr = memByG.get(x.group_id) ?? []; arr.push(x.model_id); memByG.set(x.group_id, arr);
  });

  const gById = new Map((groups ?? []).map((x: any) => [x.id, x]));
  const sugs = ((members ?? []) as any[]).flatMap(x => {
    const gr = gById.get(x.group_id); const mod = mMap.get(x.model_id);
    const pt = gr ? ptMap.get(gr.part_type_id) : null;
    if (!gr || !mod || !pt) return [];
    return [{ gid: gr.id, mid: mod.id, label: `${mod.brand} ${mod.name}`,
      sub: `${pt.emoji} ${pt.name}${gr.note ? " · " + gr.note : ""}` }];
  }).sort((a: any, b: any) => a.label.localeCompare(b.label) || a.sub.localeCompare(b.sub));

  // quick chips: first suggestion per unique phone
  const seen = new Set<string>();
  const chips = sugs.filter(s => {
    if (seen.has(s.label)) return false;
    seen.add(s.label); return true;
  }).slice(0, 8);

  const grp = g ? gById.get(g) : null;
  const pt = grp ? ptMap.get(grp.part_type_id) : null;
  const gModels = grp ? (memByG.get(grp.id) ?? [])
    .map(id => mMap.get(id)).filter(Boolean)
    .sort((a: any, b: any) => a.name.localeCompare(b.name)) : [];
  const mine = m ? mMap.get(m) : null;
  const item = grp?.item_id ? itemMap.get(grp.item_id) : null;

  const browse = (groups ?? []).slice(0, 12).map((x: any) => {
    const p = ptMap.get(x.part_type_id);
    const names = (memByG.get(x.id) ?? []).map(id => mMap.get(id)).filter(Boolean)
      .map((mm: any) => mm.name);
    return { id: x.id, emoji: p?.emoji ?? "🔧", part: p?.name ?? "Part", note: x.note,
      names, n: names.length };
  });

  return (
    <div id="wrap">
      <div className="tb">
        <a className="brand" href="/">Munshi<em>Cloud</em></a>
        <a className="nl" href="/shop">Shop</a>
        <a className="nl" href="/compat">Part finder</a>
        <span style={{ flex: 1 }} />
        <a className="nl" href="/">← Home</a>
      </div>

      <section style={{ maxWidth: 900, margin: "46px auto 20px", padding: "0 24px", textAlign: "center" }}>
        <div style={{ fontSize: 38, marginBottom: 6 }}>🔍</div>
        <h1 style={{ fontSize: "clamp(26px,4vw,38px)", margin: 0 }}>
          Which part fits <span style={{ fontStyle: "italic", color: "var(--brand)" }}>your phone?</span></h1>
        <p className="mut" style={{ fontSize: 15, margin: "10px auto 18px", maxWidth: 560 }}>
          Type your model — see every display, battery, camera and flex we have mapped,
          with all the other phones sharing the same part.</p>

        <div style={{ background: "var(--card, #fff)", border: "1px solid var(--line)",
          borderRadius: 16, padding: 18, boxShadow: "0 10px 30px rgba(0,0,0,.07)" }}>
          <CompatSearch sugs={sugs} big />
          {chips.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap",
              justifyContent: "center", marginTop: 12 }}>
              {chips.map(c => (
                <a key={c.gid + c.mid} href={`/compat?g=${c.gid}&m=${c.mid}`}
                  className="chip" style={{ fontSize: 12.5, padding: "6px 12px",
                    textDecoration: "none" }}>{c.label}</a>
              ))}
            </div>)}
        </div>
      </section>

      {grp && pt && (
        <section style={{ maxWidth: 900, margin: "14px auto 50px", padding: "0 24px" }}>
          <div className="panel" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22 }}>{pt.emoji} {pt.name}</h2>
                {grp.note && <div className="mut" style={{ fontSize: 13, marginTop: 3 }}>{grp.note}</div>}
              </div>
              <span className="chip grn" style={{ fontSize: 12 }}>
                fits {gModels.length} model{gModels.length === 1 ? "" : "s"}</span>
            </div>

            {mine && (
              <p style={{ fontSize: 14, marginTop: 12 }}>
                ✅ This {pt.name.toLowerCase()} is compatible with your
                <b> {mine.brand} {mine.name}</b>
                {gModels.length > 1 && <> and {gModels.length - 1} other model{gModels.length - 1 === 1 ? "" : "s"} below.</>}
              </p>)}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
              {gModels.map((mm: any) => (
                <span key={mm.id}
                  className={"chip" + (mm.id === m ? " grn" : "")}
                  style={{ fontSize: 13, padding: "7px 12px" }}>
                  {mm.brand} {mm.name}{mm.id === m ? " ★" : ""}
                </span>))}
            </div>

            {item && (
              <div style={{ marginTop: 18, padding: 14, border: "1px solid var(--line)",
                borderRadius: 12, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <b>{item.name}</b>
                  <div className="mut" style={{ fontSize: 12.5, marginTop: 2 }}>
                    {inr(item.pr)}{item.mrp > item.pr && <> · MRP <s>{inr(item.mrp)}</s></>} · in our store
                  </div>
                </div>
                <a className="btn pri" href="/shop">View in shop →</a>
              </div>)}
          </div>
        </section>)}

      {!grp && (
        <section style={{ maxWidth: 900, margin: "14px auto 50px", padding: "0 24px" }}>
          <h3 style={{ fontSize: 16, margin: "0 0 10px" }}>Browse mapped parts</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {browse.map(b => (
              <a key={b.id} href={`/compat?g=${b.id}`} className="panel"
                style={{ padding: 14, textDecoration: "none", color: "inherit", display: "block" }}>
                <b>{b.emoji} {b.part}</b>
                {b.note && <div className="mut" style={{ fontSize: 11.5, marginTop: 2 }}>{b.note}</div>}
                <div className="mut" style={{ fontSize: 12.5, marginTop: 6 }}>
                  {b.names.slice(0, 3).join(", ")}{b.n > 3 ? ` +${b.n - 3} more` : ""}
                </div>
              </a>))}
            {!browse.length && <div className="empty">No compatibility data yet — check back soon.</div>}
          </div>
        </section>)}

      <div className="foot">© {new Date().getFullYear()} MunshiCloud · Part compatibility checker</div>
    </div>
  );
}