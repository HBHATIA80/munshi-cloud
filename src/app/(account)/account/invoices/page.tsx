import { requireCustomer } from "@/lib/auth";
import { myBooks } from "@/sections/account/ui";
import { fmt0 } from "@/lib/format";

export default async function MyInvoicesPage() {
  const s = await requireCustomer();
  if (s.partyType !== "shopkeeper") return <div className="empty">Invoices are for shopkeeper accounts.</div>;
  const { vs } = await myBooks();
  const invs = vs.filter(v => v.type === "sale" || v.type === "salret").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="panel"><div className="tblw"><table className="t">
      <thead><tr><th>Doc</th><th>Date</th><th className="num">Total</th><th className="num">Paid</th><th className="num">Due</th></tr></thead>
      <tbody>
        {invs.map(v => (
          <tr key={v.id}>
            <td className="mono"><b>{v.no}</b> <span className={"chip " + (v.type === "sale" ? "blu" : "amb")}>{v.type === "sale" ? "invoice" : "credit note"}</span></td>
            <td>{v.date}</td><td className="num"><b>{fmt0(v.total)}</b></td>
            <td className="num">{fmt0(v.paid)}</td>
            <td className="num" style={{ color: v.total - v.paid > 0 ? "var(--red)" : "inherit" }}>
              {v.total - v.paid > 0 ? fmt0(v.total - v.paid) : "—"}</td></tr>))}
        {!invs.length && <tr><td colSpan={5}><div className="empty">No invoices yet.</div></td></tr>}
      </tbody>
    </table></div></div>
  );
}