"use client";
import { useState, useTransition } from "react";
import { postReturnAction } from "./actions";

type Doc = { id: string; no: string; date: string; total: number; lines: { item_id: string; name: string; qty: number }[] };

export function ReturnsView({ sales, purchases }: { sales: Doc[]; purchases: Doc[] }) {
  const [kind, setKind] = useState<"salret" | "purret">("salret");
  const [src, setSrc] = useState<Doc | null>(null);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const docs = kind === "salret" ? sales : purchases;
  const post = () => start(async () => {
    setErr("");
    const fd = new FormData();
    fd.set("kind", kind); fd.set("src_id", src!.id); fd.set("qtys", JSON.stringify(qtys));
    const r = await postReturnAction(fd);
    if (r.error) setErr(r.error); else { setSrc(null); setQtys({}); alert("Posted " + r.no); location.reload(); }
  });
  return (
    <div className="grid2" style={{ marginTop: 0 }}>
      <div className="panel"><div className="ph"><h3>New return</h3></div><div className="pb">
        <div className="tool">
          <button className={"fchip" + (kind === "salret" ? " on" : "")} onClick={() => { setKind("salret"); setSrc(null); setQtys({}); }}>Sales return (credit note)</button>
          <button className={"fchip" + (kind === "purret" ? " on" : "")} onClick={() => { setKind("purret"); setSrc(null); setQtys({}); }}>Purchase return (debit note)</button>
        </div>
        <label className="fl">Original {kind === "salret" ? "invoice" : "purchase"}</label>
        <select className="inp" value={src?.id ?? ""} onChange={e => { setSrc(docs.find(d => d.id === e.target.value) ?? null); setQtys({}); }}>
          <option value="">Pick…</option>
          {docs.map(d => <option key={d.id} value={d.id}>{d.no} · {d.date} · ₹{Math.round(d.total).toLocaleString("en-IN")}</option>)}
        </select>
        {src && (
          <table className="t" style={{ marginTop: 12 }}><thead>
            <tr><th>Item</th><th className="num">Billed</th><th>Return qty</th></tr></thead>
            <tbody>{src.lines.map(l => (
              <tr key={l.item_id}>
                <td>{l.name}</td><td className="num">{l.qty}</td>
                <td><input className="inp mono" type="number" min="0" max={l.qty} style={{ width: 74 }}
                  value={qtys[l.item_id] ?? ""} onChange={e => setQtys(q => ({ ...q, [l.item_id]: Math.min(+e.target.value || 0, l.qty) }))} /></td>
              </tr>))}</tbody></table>
        )}
        {src && <button className="btn pri" style={{ marginTop: 12 }} disabled={pending} onClick={post}>
          {pending ? "Posting…" : "Post " + (kind === "salret" ? "credit note" : "debit note")}</button>}
        {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
      </div></div>
      <div className="panel"><div className="ph"><h3>How returns work</h3></div><div className="pb mut" style={{ fontSize: 13, lineHeight: 1.8 }}>
        A credit note reverses the chosen quantities: stock comes back (sales) or leaves (purchases),
        and the party ledger is credited — their balance reduces automatically.
        Debit notes do the mirror image for purchases.
      </div></div>
    </div>
  );
}