"use client";
import { useActionState, useState } from "react";
import { saveMoneyAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";

type P = { id: string; name: string; type: string };
type H = { no: string; date: string; party: string; mode: string; total: number; narr: string | null };
const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

export function MoneyView({ type, parties, history }: {
  type: "receipt" | "payment"; parties: P[]; history: H[] }) {
  const isR = type === "receipt";
  const [pid, setPid] = useState("");
  const [err, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    fd.set("type", type);
    const r = await saveMoneyAction(fd);
    if (r.error) return r.error;
    location.reload();
    return null;
  }, null);

  return (
    <>
      <div className="panel">
        <div className="ph"><h3>{isR ? "Record money received" : "Record money paid"}</h3></div>
        <div className="pb">
          <div className="frm" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
            <div>
              <label className="fl">{isR ? "From party" : "To party"} *</label>
              <LiveSearch items={parties} getLabel={p => p.name}
                getSub={p => p.type}
                placeholder="Type to search among all parties…"
                selectedId={pid || undefined}
                onPick={p => setPid(p?.id ?? "")} />
              <input type="hidden" name="party_id" value={pid} />
            </div>
            <div><label className="fl">Amount *</label>
              <input className="inp mono" name="amount" type="number" min="0" /></div>
            <div><label className="fl">Mode</label>
              <select className="inp" name="mode">
                {["cash", "upi", "bank", "cheque"].map(m => <option key={m}>{m}</option>)}
              </select></div>
            <div><label className="fl">Date</label>
              <input className="inp mono" type="date" name="date"
                defaultValue={new Date().toISOString().slice(0, 10)} /></div>
            <div className="full"><label className="fl">Note</label>
              <input className="inp" name="narr" /></div>
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 10, alignItems: "center" }}>
            <button className="btn pri" disabled={pending}>
              {pending ? "Posting…" : "Post " + (isR ? "receipt" : "payment")}</button>
            <span className="mut" style={{ fontSize: 12 }}>
              {isR && "Receipts auto-adjust the oldest unpaid invoices first (FIFO)."}</span>
          </div>
          {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="ph"><h3>History</h3></div>
        <div className="tblw"><table className="t">
          <thead><tr><th>No</th><th>Date</th><th>Party</th><th>Mode</th>
            <th className="num">Amount</th><th>Note</th></tr></thead>
          <tbody>
            {history.map(h => (
              <tr key={h.no}>
                <td className="mono"><b>{h.no}</b></td>
                <td>{h.date}</td>
                <td>{h.party}</td>
                <td>{h.mode}</td>
                <td className="num" style={{ fontWeight: 700 }}>{inr(h.total)}</td>
                <td className="mut" style={{ fontSize: 12 }}>{h.narr}</td>
              </tr>))}
            {!history.length && (
              <tr><td colSpan={6}><div className="empty">None yet.</div></td></tr>)}
          </tbody>
        </table></div>
      </div>
    </>
  );
}