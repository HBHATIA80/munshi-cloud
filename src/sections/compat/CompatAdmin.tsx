"use client";
import { useMemo, useState, useTransition } from "react";
import { saveCompatGroupAction, deleteCompatGroupAction, upsertModelAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";
import { showAlert, showConfirm } from "@/components/Alert";

type PT = { id: string; name: string; emoji: string };
type M = { id: string; brand: string; name: string };
type G = { id: string; ptId: string; modelIds: string[]; note: string | null; itemId: string | null };
type IT = { id: string; name: string; pr: number; stock: number };
type Sel = { id?: string; brand: string; name: string };

export function CompatAdmin({ partTypes, models, groups, items }: {
  partTypes: PT[]; models: M[]; groups: G[]; items: IT[] }) {
  const [q, setQ] = useState("");
  const [ptF, setPtF] = useState("all");
  const [edit, setEdit] = useState<G | "new" | null>(null);
  const [pending, start] = useTransition();

  const ptMap = useMemo(() => new Map(partTypes.map(p => [p.id, p])), [partTypes]);
  const mMap = useMemo(() => new Map(models.map(m => [m.id, m])), [models]);
  const rows = groups.map(g => ({ ...g,
    names: g.modelIds.map(id => mMap.get(id)).filter(Boolean)
      .map(m => `${m!.brand} ${m!.name}`) }))
    .filter(g => (ptF === "all" || g.ptId === ptF) &&
      (!q || g.names.join(" ").toLowerCase().includes(q.toLowerCase()) ||
        (g.note ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <>
      <div className="tool">
        <input className="inp" style={{ maxWidth: 240 }} placeholder="Search models / note…"
          value={q} onChange={e => setQ(e.target.value)} />
        <select className="inp" style={{ width: 190 }} value={ptF}
          onChange={e => setPtF(e.target.value)}>
          <option value="all">All part types</option>
          {partTypes.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
        </select>
        <span className="chip">{groups.length} groups</span>
        <span style={{ flex: 1 }} />
        <button className="btn pri" onClick={() => setEdit("new")}>＋ New group</button>
      </div>

      <div className="panel"><div className="tblw"><table className="t">
        <thead><tr><th>Part type</th><th>Compatible models</th><th>Note</th>
          <th>Linked product</th><th /></tr></thead>
        <tbody>
          {rows.map(g => {
            const pt = ptMap.get(g.ptId);
            return (
              <tr key={g.id}>
                <td><b>{pt?.emoji} {pt?.name ?? "?"}</b></td>
                <td style={{ maxWidth: 380 }}>
                  {g.names.slice(0, 6).join(", ")}
                  {g.names.length > 6 && <span className="mut"> +{g.names.length - 6} more</span>}
                </td>
                <td className="mut" style={{ fontSize: 12 }}>{g.note || "—"}</td>
                <td>{g.itemId
                  ? <span className="chip">{items.find(i => i.id === g.itemId)?.name ?? "item"}</span>
                  : <span className="mut">—</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="ib" title="Edit" onClick={() => setEdit(g)}>✎</button>
                  <button className="ib" title="Delete" disabled={pending}
                    onClick={() => start(async () => {
                      if (await showConfirm("Delete group",
                        "All compatibility links in this group will be removed.")) {
                        const r = await deleteCompatGroupAction(g.id);
                        if (r.error) showAlert("Delete failed", r.error, "❌");
                        else location.reload();
                      }
                    })}>🗑</button>
                </td>
              </tr>);
          })}
          {!rows.length && <tr><td colSpan={5}><div className="empty">
            No groups yet — create the first one.</div></td></tr>}
        </tbody>
      </table></div></div>

      {edit && <GroupEditor partTypes={partTypes} models={models} items={items}
        group={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function GroupEditor({ partTypes, models, items, group, onClose }: {
  partTypes: PT[]; models: M[]; items: IT[]; group: G | null; onClose: () => void }) {
  const [ptId, setPtId] = useState(group?.ptId ?? "");
  const [itemId, setItemId] = useState(group?.itemId ?? "");
  const [note, setNote] = useState(group?.note ?? "");
  const [sel, setSel] = useState<Sel[]>(group
    ? group.modelIds.map(id => models.find(m => m.id === id))
        .filter(Boolean).map(m => ({ id: m!.id, brand: m!.brand, name: m!.name }))
    : []);
  const [nBrand, setNBrand] = useState("");
  const [nName, setNName] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const add = (m: Sel) => {
    if (sel.some(s => (s.id && s.id === m.id) ||
        (!s.id && s.brand === m.brand && s.name.toLowerCase() === m.name.toLowerCase()))) return;
    setSel(l => [...l, m]);
  };
  const save = () => start(async () => {
    setErr("");
    const ids: string[] = [];
    for (const m of sel) {
      if (m.id) { ids.push(m.id); continue; }
      const r = await upsertModelAction(m.brand, m.name);
      if (r.error || !r.id) { setErr(r.error ?? "Could not save model."); return; }
      ids.push(r.id);
    }
    const r = await saveCompatGroupAction(ptId, ids, itemId, note, group?.id);
    if (r.error) setErr(r.error); else location.reload();
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 90, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 640, maxWidth: "100%", maxHeight: "92vh",
        overflow: "auto", padding: 20 }}>
        <h3 style={{ marginBottom: 4 }}>{group ? "Edit compatibility group" : "New compatibility group"}</h3>
        <p className="mut" style={{ fontSize: 12, marginBottom: 12 }}>
          Every model below uses the <b>same physical part</b> for the chosen part type —
          they are all compatible with each other.</p>

        <div className="frm" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div>
            <label className="fl">Part type *</label>
            <select className="inp" value={ptId} onChange={e => setPtId(e.target.value)}>
              <option value="">Select…</option>
              {partTypes.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">Link to catalog product (optional)</label>
            <LiveSearch items={items} getLabel={i => i.name}
              getSub={i => `₹${i.pr} · stock ${i.stock}`}
              placeholder="Search your products…" selectedId={itemId || undefined}
              onPick={i => setItemId(i?.id ?? "")} />
          </div>
          <div className="full">
            <label className="fl">Note (e.g. OLED grade, family name)</label>
            <input className="inp" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <label className="fl" style={{ marginTop: 12 }}>Add existing model</label>
        <LiveSearch items={models} getLabel={m => `${m.brand} ${m.name}`} getSub={m => m.brand}
          placeholder="Type model name…" onPick={m => { if (m) add({ id: m.id, brand: m.brand, name: m.name }); }} />

        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <input className="inp" placeholder="New brand (e.g. Vivo)" value={nBrand}
            style={{ maxWidth: 150 }} onChange={e => setNBrand(e.target.value)} />
          <input className="inp" placeholder="New model name (e.g. V27 Pro)" value={nName}
            onChange={e => setNName(e.target.value)} />
          <button className="btn" onClick={() => {
            if (!nBrand.trim() || !nName.trim()) return;
            add({ brand: nBrand.trim(), name: nName.trim() });
            setNName("");
          }}>＋ Add</button>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
          {sel.map((m, i) => (
            <span className="chip" key={i} style={{ fontSize: 12 }}>
              {m.brand} {m.name}
              <button className="ib" style={{ marginLeft: 4 }} title="Remove"
                onClick={() => setSel(l => l.filter((_, j) => j !== i))}>✕</button>
            </span>))}
          {!sel.length && <span className="mut" style={{ fontSize: 12 }}>
            Add at least two models that share this part.</span>}
        </div>

        {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save group"}</button>
        </div>
      </div>
    </div>
  );
}