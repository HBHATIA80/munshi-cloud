"use client";
import { useRef, useState, useTransition } from "react";
import { saveCatAction, saveSubAction, saveBrandAction, deleteCatAction, deleteBrandAction } from "./actions";
import { showAlert, showConfirm } from "@/components/Alert";

type Cat = { id: string; name: string; emoji: string; parent_id: string | null };
type Brand = { id: string; name: string };

export function CatsView({ cats, brands, catCounts, brandCounts }: {
  cats: Cat[]; brands: Brand[]; catCounts: Record<string, number>; brandCounts: Record<string, number> }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();
  const match = (n: string) => !ql || n.toLowerCase().includes(ql);
  const catForm = useRef<HTMLFormElement>(null);
  const subForm = useRef<HTMLFormElement>(null);
  const brandForm = useRef<HTMLFormElement>(null);
  const top = cats.filter(c => !c.parent_id && match(c.name));
  const subs = cats.filter(c => c.parent_id && match(c.name));
  const brandList = brands.filter(b => match(b.name));

  return (
    <>
      {err && <p className="neg" style={{ fontSize: 13, marginBottom: 10 }}>{err}</p>}
      <div className="tool" style={{ marginBottom: 10 }}>
        <input className="inp" style={{ maxWidth: 240 }} placeholder="Filter categories / brands…"
          value={q} onChange={e => setQ(e.target.value)} />
        {(top.length || subs.length || brandList.length) ? null
          : <span className="mut" style={{ fontSize: 12 }}>no matches for “{q}”</span>}
      </div>
      <div className="grid2" style={{ marginTop: 0 }}>
        <div className="stack">
          <div className="panel"><div className="ph"><h3>Categories</h3></div><div className="pb">
            <form ref={catForm} action={fd => start(async () => {
              setErr("");
              try {
                await saveCatAction(String(fd.get("name") || ""), String(fd.get("emoji") || ""));
                catForm.current?.reset();
              } catch (e: any) { setErr(e.message); }
            })} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input className="inp" name="name" placeholder="e.g. Spare Parts" required />
              <input className="inp" name="emoji" placeholder="🔧" style={{ width: 64, textAlign: "center" }} />
              <button className="btn pri" disabled={pending}>Add</button>
            </form>
            {top.map(c => (
              <div className="led-row" key={c.id}>
                <span><b>{c.emoji} {c.name}</b> <span className="mut" style={{ fontSize: 11 }}>
                  · {catCounts[c.id] ?? 0} items</span></span>
                <button className="ib" title="Delete"
                  onClick={() => start(async () => {
                    setErr("");
                    if (await showConfirm("Delete category", `Delete "${c.name}"?`)) {
                      try { await deleteCatAction(c.id); } catch (e: any) { setErr(e.message); }
                    }
                  })}>🗑</button>
              </div>))}
            {!top.length && <p className="mut" style={{ fontSize: 12.5 }}>
              {ql ? "No categories match the filter." : "None yet — add your first category above."}</p>}
          </div></div>
          <div className="panel"><div className="ph"><h3>Brands</h3></div><div className="pb">
            <form ref={brandForm} action={fd => start(async () => {
              setErr("");
              try {
                const r = await saveBrandAction(String(fd.get("bname") || ""));
                if (r.error) setErr(r.error);
                else brandForm.current?.reset();
              } catch (e: any) { setErr(e.message); }
            })} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
              <input className="inp" name="bname" placeholder="e.g. Samsung, Apple, BoAt" required />
              <button className="btn pri" disabled={pending}>Add</button>
            </form>
            {brandList.map(b => (
              <div className="led-row" key={b.id}>
                <span><b>{b.name}</b> <span className="mut" style={{ fontSize: 11 }}>
                  · {brandCounts[b.id] ?? 0} items</span></span>
                <button className="ib" title="Delete"
                  onClick={() => start(async () => {
                    setErr("");
                    if (await showConfirm("Delete brand", `Delete "${b.name}"?`)) {
                      try { await deleteBrandAction(b.id); } catch (e: any) { setErr(e.message); }
                    }
                  })}>🗑</button>
              </div>))}
            {!brandList.length && <p className="mut" style={{ fontSize: 12.5 }}>
              {ql ? "No brands match the filter." : "No brands yet — add them here, or create inline while adding items."}</p>}
          </div></div>
        </div>
        <div className="panel"><div className="ph"><h3>Sub-categories</h3></div><div className="pb">
          <form ref={subForm} action={fd => start(async () => {
            setErr("");
            try {
              await saveSubAction(String(fd.get("name") || ""), String(fd.get("parent") || ""));
              subForm.current?.reset();
            } catch (e: any) { setErr(e.message); }
          })} style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            <select className="inp" name="parent" style={{ width: 140 }}>
              {cats.filter(c => !c.parent_id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input className="inp" name="name" placeholder="Name…" required />
            <button className="btn pri" disabled={pending}>Add</button>
          </form>
          {subs.map(s => (
            <div className="led-row" key={s.id}>
              <span>{top.find(x => x.id === s.parent_id)?.name
                ?? cats.find(x => x.id === s.parent_id)?.name} → <b>{s.name}</b></span>
              <button className="ib" title="Delete"
                onClick={() => start(async () => {
                  setErr("");
                  if (await showConfirm("Delete sub-category", `Delete "${s.name}"?`)) {
                    try { await deleteCatAction(s.id); } catch (e: any) { setErr(e.message); }
                  }
                })}>🗑</button>
            </div>))}
          {!subs.length && <p className="mut" style={{ fontSize: 12.5 }}>
            {ql ? "No sub-categories match the filter." : "None yet."}</p>}
        </div></div>
      </div>
    </>
  );
}