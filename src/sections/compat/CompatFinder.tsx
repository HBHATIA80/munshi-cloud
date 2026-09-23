"use client";
import { useMemo, useState } from "react";

type M = { id: string; brand: string; name: string };
type PT = { id: string; name: string; emoji: string };
type G = { id: string; ptId: string; pt: string; emoji: string; modelIds: string[];
  note: string | null; item: { name: string; pr: number; mrp: number } | null };

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

export function CompatFinder({ models, partTypes, groups }: {
  models: M[]; partTypes: PT[]; groups: G[] }) {
  const [brand, setBrand] = useState("");
  const [modelId, setModelId] = useState("");
  const [ptId, setPtId] = useState("all");

  const brands = useMemo(() => [...new Set(models.map(m => m.brand))].sort(), [models]);
  const brandModels = useMemo(
    () => models.filter(m => m.brand === brand).sort((a, b) => a.name.localeCompare(b.name)),
    [models, brand]);
  const my = models.find(m => m.id === modelId) ?? null;

  const results = useMemo(() => {
    if (!modelId) return [];
    return groups
      .filter(g => g.modelIds.includes(modelId) && (ptId === "all" || g.ptId === ptId))
      .map(g => ({
        ...g,
        others: g.modelIds.filter(id => id !== modelId)
          .map(id => models.find(m => m.id === id)?.name)
          .filter(Boolean) as string[],
      }))
      .sort((a, b) => a.pt.localeCompare(b.pt));
  }, [groups, models, modelId, ptId]);

  const sharedWith = new Set(results.flatMap(r => r.others)).size;

  return (
    <section className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="ph" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <h3 style={{ margin: 0 }}>🔍 Part Compatibility Checker</h3>
        <span className="mut" style={{ fontSize: 12 }}>
          Find exactly which parts fit your phone — displays, batteries, cameras and more.</span>
      </div>
      <div className="pb" style={{ padding: 16 }}>
        <div className="frm" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
          <div>
            <label className="fl">1 · Brand</label>
            <select className="inp" value={brand}
              onChange={e => { setBrand(e.target.value); setModelId(""); }}>
              <option value="">Select brand…</option>
              {brands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">2 · Your phone model</label>
            <select className="inp" value={modelId} disabled={!brand}
              onChange={e => setModelId(e.target.value)}>
              <option value="">{brand ? "Select model…" : "Pick a brand first"}</option>
              {brandModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="fl">3 · Part type</label>
            <select className="inp" value={ptId} onChange={e => setPtId(e.target.value)}>
              <option value="all">All parts</option>
              {partTypes.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>)}
            </select>
          </div>
        </div>

        {my && (
          <p className="mut" style={{ fontSize: 13, margin: "12px 0 4px" }}>
            {results.length
              ? <>{sharedWith} model{sharedWith === 1 ? "" : "s"} share parts with your <b>{brand} {my.name}</b> — {results.length} part type{results.length === 1 ? "" : "s"} mapped.</>
              : <>No compatibility data for <b>{brand} {my.name}</b> yet — check back soon.</>}
          </p>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
          gap: 10, marginTop: 10 }}>
          {results.map(r => (
            <div key={r.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <b style={{ fontSize: 14 }}>{r.emoji} {r.pt}</b>
                {r.item
                  ? <span className="chip grn">{inr(r.item.pr)}</span>
                  : <span className="chip">{r.others.length + 1} models</span>}
              </div>
              {r.note && <div className="mut" style={{ fontSize: 11.5, marginTop: 2 }}>{r.note}</div>}
              <div style={{ fontSize: 13, marginTop: 8, lineHeight: 1.55 }}>
                Fits <b>{my?.name}</b>
                {r.others.length
                  ? <> — also fits {r.others.map((n, i) => (
                      <span key={i}>{i > 0 && ", "} <b>{n}</b></span>))}</>
                  : <span className="mut"> — no other models mapped yet</span>}
              </div>
              {r.item && (
                <div className="mut" style={{ fontSize: 12, marginTop: 6 }}>
                  In our store: <b>{r.item.name}</b>
                  {r.item.mrp > r.item.pr && <> · MRP <s>{inr(r.item.mrp)}</s></>}
                </div>)}
            </div>))}
        </div>

        {!modelId && (
          <div className="empty" style={{ marginTop: 10 }}>
            Select your phone above to see which parts are shared across models.
          </div>)}
      </div>
    </section>
  );
}