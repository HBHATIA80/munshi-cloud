import { requireCustomer } from "@/lib/auth";
import { myBooks } from "@/sections/account/ui";
import { fmt0 } from "@/lib/format";

export default async function MyReceiptsPage() {
  const s = await requireCustomer();
  if (s.partyType !== "shopkeeper") return <div className="empty">Receipts are for shopkeeper accounts.</div>;
  const { vs } = await myBooks();
  const rc = vs.filter(v => v.type === "receipt").sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="panel"><div className="tblw"><table className="t">
      <thead><tr><th>Receipt</th><th>Date</th><th>Mode</th><th className="num">Amount</th><th>Note</th></tr></thead>
      <tbody>
        {rc.map(v => (<tr key={v.id}><td className="mono"><b>{v.no}</b></td><td>{v.date}</td>
          <td>{v.mode}</td><td className="num pos"><b>{fmt0(v.total)}</b></td>
          <td className="mut" style={{ fontSize: 12 }}>{v.narr}</td></tr>))}
        {!rc.length && <tr><td colSpan={5}><div className="empty">Nothing yet.</div></td></tr>}
      </tbody>
    </table></div></div>
  );
}