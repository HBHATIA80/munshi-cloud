"use client";
import { useActionState, useState, useTransition } from "react";
import { saveExpenseAction, deleteExpenseAction } from "./actions";

type E = { id: string; head: string; amount: number; mode: string; date: string; narr: string | null };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function ExpensesView({ rows, heads }: { rows: E[]; heads: string[] }) {
  const [err, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    try { await saveExpenseAction(fd); } catch (e: any) { return e.message; }
    return null;
  }, null);
  const [, start] = useTransition();
  return (
    <>
      <div className="panel"><div className="ph"><h3>Record expense</h3></div>
        <form action={submit} className="pb"><div className="frm" style={{ gridTemplateColumns: "2fr 1fr 1fr 1fr" }}>
          <div><label className="fl">Head *</label>
            <input className="inp" name="head" list="heads" placeholder="Rent, Tea, Transport…" required />
            <datalist id="heads">{heads.map(h => <option key={h} value={h} />)}</datalist></div>
          <div><label className="fl">Amount *</label><input className="inp mono" name="amount" type="number" min="0" required /></div>
          <div><label className="fl">Mode</label><select className="inp" name="mode">
            {["cash", "upi", "bank", "cheque"].map(m => <option key={m}>{m}</option>)}</select></div>
          <div><label className="fl">Date</label><input className="inp mono" type="date" name="date"
            defaultValue={new Date().toISOString().slice(0, 10)} /></div>
          <div className="full"><label className="fl">Note</label><input className="inp" name="narr" /></div>
        </div>
        {err && <p className="neg" style={{ fontSize: 13, marginTop: 8 }}>{err}</p>}
        <button className="btn pri" style={{ marginTop: 12 }} disabled={pending}>
          {pending ? "Saving…" : "Save expense"}</button>
        </form></div>
      <div className="panel" style={{ marginTop: 16 }}><div className="ph"><h3>This month</h3>
        <span className="chip">{rows.length} entries · {inr(rows.reduce((t, r) => t + r.amount, 0))}</span></div>
        <div className="tblw"><table className="t">
          <thead><tr><th>Date</th><th>Head</th><th>Mode</th><th className="num">Amount</th><th>Note</th><th /></tr></thead>
          <tbody>{rows.map(e => (
            <tr key={e.id}><td>{e.date}</td><td><b>{e.head}</b></td><td>{e.mode}</td>
              <td className="num neg"><b>{inr(e.amount)}</b></td>
              <td className="mut" style={{ fontSize: 12 }}>{e.narr}</td>
              <td><button className="ib" onClick={() => { if (confirm("Delete " + e.head + "?"))
                start(async () => { try { await deleteExpenseAction(e.id); location.reload(); } catch (x: any) { alert(x.message); } }); }}>🗑</button></td></tr>))}
            {!rows.length && <tr><td colSpan={6}><div className="empty">No expenses this month.</div></td></tr>}</tbody>
        </table></div></div>
    </>
  );
}