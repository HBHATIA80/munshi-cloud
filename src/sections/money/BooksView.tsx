"use client";
import { CsvBtn } from "@/lib/CsvBtn";
import { useRouter } from "next/navigation";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function BooksView({ rows, from, to, acct, totDr, totCr }: {
  rows: { date: string; no: string; type: string; acct: string; dr: number; cr: number; narr: string }[];
  from: string; to: string; acct: string; totDr: number; totCr: number }) {
  const router = useRouter();
  return (
    <>
      <form className="tool" method="get">
        <input className="inp mono" type="date" name="from" defaultValue={from} style={{ width: 135 }} />
        <input className="inp mono" type="date" name="to" defaultValue={to} style={{ width: 135 }} />
        <input className="inp" name="acct" defaultValue={acct} placeholder="Filter account (e.g. Cash, GST)…" style={{ maxWidth: 260 }} />
        <button className="btn sm">Go</button>
      </form>
      <div className="panel"><div className="ph"><h3>Books of Accounts — journal</h3>
        <CsvBtn name="books.csv" rows={[["Date", "Voucher", "Type", "Account", "Debit", "Credit"],
          ...rows.map(r => [r.date, r.no, r.type, r.acct, r.dr || "", r.cr || ""])]} /></div>
      <div className="tblw"><table className="t">
        <thead><tr><th>Date</th><th>Voucher</th><th>Account</th>
          <th className="num">Debit</th><th className="num">Credit</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td>{r.date}</td><td className="mono"><b>{r.no}</b></td>
            <td><b>{r.acct}</b> <span className="chip">{r.type}</span></td>
            <td className="num">{r.dr ? inr(r.dr) : ""}</td>
            <td className="num">{r.cr ? inr(r.cr) : ""}</td></tr>))}
          {!rows.length && <tr><td colSpan={5}><div className="empty">No entries in range.</div></td></tr>}
        </tbody>
        <tfoot><tr className="tfo"><td colSpan={3}>Totals</td>
          <td className="num">{inr(totDr)}</td><td className="num">{inr(totCr)}</td></tr></tfoot>
      </table></div></div>
      <p className="mut" style={{ fontSize: 11.5, marginTop: 10 }}>
        Double-entry view: each voucher expands to its Dr/Cr legs (Debtor/Cash ↔ Sales, Stock ↔ Creditor, etc.).
        Filter by any account name to see its book.</p>
    </>
  );
}