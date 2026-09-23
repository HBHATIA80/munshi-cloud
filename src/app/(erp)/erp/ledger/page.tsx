import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LedgerPicker } from "@/sections/money/LedgerPicker";
import { ledgerRows, type Voucher, type Party } from "@/lib/books";
import { CsvBtn } from "@/lib/CsvBtn";
import { LedgerVoucherClient } from "@/sections/money/LedgerVoucherClient";

export default async function LedgerPage({ searchParams }:
  { searchParams: Promise<{ p?: string }> }) {
  await requireStaff();
  const { p } = await searchParams;
  const sb = await createClient();
  const [{ data: parties }, { data: vs }] = await Promise.all([
    sb.from("parties").select("*").order("name"),
    sb.from("vouchers").select("*").order("date"),
  ]);
  const P = (parties ?? []) as unknown as Party[];
  const V = (vs ?? []) as unknown as Voucher[];
  const cur = P.find(x => x.id === p) ?? P[0];
  const pname = (id: unknown) => P.find(x => x.id === id)?.name ?? "—";

  // counterparty names for journal legs (for the Particulars column)
  const jnlCp = new Map<string, string>();
  for (const v of V) {
    if (v.type === "journal" && /-[AB]$/.test(v.no)) {
      const base = v.no.replace(/-[AB]$/, "");
      const other = V.find(x => x.no === base + (v.no.endsWith("-A") ? "-B" : "-A"));
      if (other) jnlCp.set(v.no, pname(other.party_id));
    }
  }

  // journal Dr/Cr convention:
  //   JNL-xxxx-A (From party) -> Debit  (balance moves away)
  //   JNL-xxxx-B (To party)   -> Credit (balance arrives)
  const raw = cur ? ledgerRows(V, cur.id) : [];
  const rows = raw.map(r => {
    if (r.no.startsWith("JNL-")) {
      const amt = (r.dr || 0) || (r.cr || 0);
      const isA = r.no.endsWith("-A");
      const cp = jnlCp.get(r.no);
      const part = cp ? (isA ? `Journal → ${cp}` : `Journal ← ${cp}`) : r.part;
      return { ...r, part, dr: isA ? amt : 0, cr: isA ? 0 : amt };
    }
    return r;
  });

  let run = cur ? (cur.open || 0) : 0;
  // closing includes journal legs (partyBalance ignores them)
  const bal = cur
    ? Math.round(((cur.open || 0)
        + rows.reduce((t, r) => t + (r.dr || 0) - (r.cr || 0), 0)) * 100) / 100
    : 0;

  return (
    <>
      <div className="tool">
        <LedgerPicker parties={P.map(x => ({ id: x.id, name: x.name, type: x.type }))} current={cur?.id ?? ""} />
        <span style={{ flex: 1 }} />
        <CsvBtn name="ledger.csv" rows={[["Date", "Particulars", "Ref", "Debit", "Credit"],
          ...rows.map(r => [r.date, r.part, r.no, r.dr || "", r.cr || ""])]} />
      </div>
      {cur ? (
        <div className="panel">
          <div className="ph">
            <div><h3>{cur.name}</h3>
              <div className="mut" style={{ fontSize: 12 }}>
                {cur.type} · {cur.mobile ?? ""} · {cur.state ?? ""}</div></div>
            <div style={{ textAlign: "right" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Closing</div>
              <b style={{ font: "600 20px var(--font-disp)" }}>
                ₹{Math.abs(bal).toLocaleString("en-IN")} {bal >= 0 ? "Dr" : "Cr"}</b>
            </div>
          </div>
          <div className="tblw"><table className="t">
            <thead><tr><th>Date</th><th>Particulars</th><th>Ref</th>
              <th className="num">Debit</th><th className="num">Credit</th><th className="num">Balance</th></tr></thead>
            <tbody>
              {!!cur.open && <tr><td>—</td><td><b>Opening balance</b></td><td />
                <td className="num">{cur.open > 0 ? "₹" + cur.open.toLocaleString("en-IN") : ""}</td>
                <td className="num">{cur.open < 0 ? "₹" + (-cur.open).toLocaleString("en-IN") : ""}</td>
                <td className="num">₹{Math.abs(cur.open).toLocaleString("en-IN")} {cur.open >= 0 ? "Dr" : "Cr"}</td></tr>}
              {rows.map((r, i) => {
                run = Math.round((run + (r.dr || 0) - (r.cr || 0)) * 100) / 100;
                const v = V.find(x => x.no === r.no);
                return (
                  <tr key={i}>
                    <td>{r.date}</td>
                    <td>{r.part}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {v ? <b className="linkish" data-voucher={v.id}>{r.no}</b> : r.no}
                    </td>
                    <td className="num">{r.dr ? "₹" + r.dr.toLocaleString("en-IN") : ""}</td>
                    <td className="num">{r.cr ? "₹" + r.cr.toLocaleString("en-IN") : ""}</td>
                    <td className="num" style={{ fontWeight: 700 }}>₹{Math.abs(run).toLocaleString("en-IN")} {run >= 0 ? "Dr" : "Cr"}</td>
                  </tr>);
              })}
              {!rows.length && <tr><td colSpan={6}><div className="empty">No transactions.</div></td></tr>}
            </tbody>
          </table></div>
        </div>
      ) : <div className="empty">No parties yet.</div>}
      {/* client wrapper makes voucher numbers clickable → edit modal */}
      <LedgerVoucherLinks vouchers={V.filter(x => cur && x.party_id === cur.id)} />
    </>
  );
}

function LedgerVoucherLinks({ vouchers }: { vouchers: Voucher[] }) {
  return <LedgerVoucherClient vouchers={vouchers.map(v => ({
    id: v.id, no: v.no, type: v.type,
    kind: (v.type === "sale" || v.type === "purchase" || v.type === "salret" || v.type === "purret")
      ? (v.type as "sale" | "purchase" | "salret" | "purret")
      : v.type === "journal" ? "journal" as const
      : v.type === "receipt" ? "receipt" as const
      : "payment" as const,
  }))} />;
}