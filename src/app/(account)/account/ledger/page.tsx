import { requireCustomer } from "@/lib/auth";
import { myBooks } from "@/sections/account/ui";
import { ledgerRows } from "@/lib/books";
import { fmt0 } from "@/lib/format";
import { LedgerCsv } from "@/sections/account/LedgerCsv";

export default async function MyLedgerPage() {
  const s = await requireCustomer();
  if (s.partyType !== "shopkeeper") return <div className="empty">Ledger is for shopkeeper accounts.</div>;
  const { party, vs } = await myBooks();
  if (!party) return <div className="empty">Account setup incomplete — contact the shop.</div>;
  const rows = ledgerRows(vs, party.id);
  let run = party.open || 0;
  const bal = rows.reduce((t, r) => t + r.dr - r.cr, party.open || 0);
  return (
    <div className="panel">
      <div className="ph">
        <h3>My ledger</h3>
        <div style={{ textAlign: "right" }}>
          <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Closing</div>
          <b style={{ font: "600 20px var(--font-disp)" }}>
            {fmt0(Math.abs(bal))} {bal >= 0 ? "payable" : "advance"}</b>
        </div>
      </div>
      <div className="tblw"><table className="t">
        <thead><tr><th>Date</th><th>Particulars</th><th>Ref</th><th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
        <tbody>
          {!!party.open && <tr><td>—</td><td><b>Opening balance</b></td><td />
            <td className="num">{party.open > 0 ? fmt0(party.open) : ""}</td>
            <td className="num">{party.open < 0 ? fmt0(-party.open) : ""}</td>
            <td className="num">{fmt0(Math.abs(party.open))} {party.open >= 0 ? "Dr" : "Cr"}</td></tr>}
          {rows.map((r, i) => {
            run = Math.round((run + r.dr - r.cr) * 100) / 100;
            return (<tr key={i}><td>{r.date}</td><td>{r.part}</td>
              <td className="mono" style={{ fontSize: 11.5 }}>{r.no}</td>
              <td className="num">{r.dr ? fmt0(r.dr) : ""}</td>
              <td className="num">{r.cr ? fmt0(r.cr) : ""}</td>
              <td className="num" style={{ fontWeight: 700 }}>{fmt0(Math.abs(run))} {run >= 0 ? "Dr" : "Cr"}</td></tr>);
          })}
          {!rows.length && <tr><td colSpan={6}><div className="empty">No transactions yet.</div></td></tr>}
        </tbody>
      </table></div>
      <div className="pb" style={{ display: "flex", justifyContent: "flex-end" }}>
        <LedgerCsv rows={rows} />
      </div>
    </div>
  );
}