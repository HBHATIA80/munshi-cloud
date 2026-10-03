import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { LedgerPicker } from "@/sections/money/LedgerPicker";
import { ledgerRows, type Voucher, type Party } from "@/lib/books";
import { CsvBtn } from "@/lib/CsvBtn";
import { LedgerVoucherClient } from "@/sections/money/LedgerVoucherClient";

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dow = (d: string) => {
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt.getTime()) ? "" : DAY[dt.getDay()];
};

export default async function LedgerPage({ searchParams }:
  { searchParams: Promise<{ p?: string; from?: string; to?: string; q?: string;
    size?: string; pg?: string; sort?: string; dir?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const p = sp.p;
  const from = sp.from || "";
  const to = sp.to || "";
  const q = (sp.q || "").trim();
  const size = Math.min(500, Math.max(10, +(sp.size || 25) || 25));
  const pg = Math.max(1, +(sp.pg || 1) || 1);
  // default: newest first
  const sort = (["date", "dr", "cr"].includes(sp.sort || "") ? sp.sort : "date")!;
  const dir = (sp.dir === "asc" ? "asc" : "desc")!;

  const sb = await createClient();
  const [{ data: parties }, { data: vs }] = await Promise.all([
    sb.from("parties").select("*").order("name"),
    sb.from("vouchers").select("*").order("date"),
  ]);
  const P = (parties ?? []) as unknown as Party[];
  const V = (vs ?? []) as unknown as Voucher[];
  const cur = P.find(x => x.id === p) ?? P[0];

  // counterparty name for a journal leg (the other side of the pair)
  const cpOf = (v: Voucher): string => {
    if (v.type === "journal" && /-[AB]$/.test(v.no)) {
      const base = v.no.replace(/-[AB]$/, "");
      const other = V.find(x => x.no === base + (v.no.endsWith("-A") ? "-B" : "-A"));
      return other ? (P.find(x => x.id === other.party_id)?.name ?? "") : "";
    }
    return "";
  };

  // journal convention: -A (From/payer) = Credit, -B (To/receiver) = Debit
  const raw = cur ? ledgerRows(V, cur.id) : [];
  const all = raw.map(r => {
    const v = V.find(x => x.no === r.no && x.party_id === cur?.id);
    let part = r.part;
    if (r.no.startsWith("JNL-") && v) {
      const amt = (r.dr || 0) || (r.cr || 0);
      const cp = cpOf(v);
      if (cp) part = (r.no.endsWith("-A") ? "Journal ← " : "Journal → ") + cp;
      return {
        date: r.date, part, no: r.no,
        dr: r.no.endsWith("-A") ? 0 : amt,
        cr: r.no.endsWith("-A") ? amt : 0,
        dow: dow(r.date),
      };
    }
    return { date: r.date, part, no: r.no, dr: r.dr || 0, cr: r.cr || 0, dow: dow(r.date) };
  });

  // filters
  const inRange = (d: string) => (!from || d >= from) && (!to || d <= to);
  const ql = q.toLowerCase();
  const filtered = all.filter(r => {
    if (!inRange(r.date)) return false;
    if (ql && !(r.no + " " + r.part).toLowerCase().includes(ql)) return false;
    return true;
  });

  // ── sorting ──
  const signed = (r: typeof filtered[number]) => (r.dr || 0) - (r.cr || 0);
  const sorted = [...filtered].sort((a, b) => {
    let c = 0;
    if (sort === "date") c = a.date.localeCompare(b.date) || a.no.localeCompare(b.no);
    else if (sort === "dr") c = (a.dr || 0) - (b.dr || 0);
    else if (sort === "cr") c = (a.cr || 0) - (b.cr || 0);
    return dir === "asc" ? c : -c;
  });

  // running balance: computed in the SORTED order (chronology is a view choice)
  const opening = cur?.open || 0;
  const beforeSum = from
    ? all.filter(r => r.date < from).reduce((t, r) => t + r.dr - r.cr, 0)
    : 0;
  const startBal = Math.round((opening + beforeSum) * 100) / 100;
  const runBalances = sorted.map((_, idx) => {
    let run = startBal;
    for (let k = 0; k <= idx; k++) run = Math.round((run + sorted[k].dr - sorted[k].cr) * 100) / 100;
    return run;
  });

  // pagination window
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  const curPg = Math.min(pg, pages);
  const view = sorted.slice((curPg - 1) * size, curPg * size);

  // closing = true lifetime balance (order-independent)
  const bal = cur
    ? Math.round(((cur.open || 0)
        + all.reduce((t, r) => t + r.dr - r.cr, 0)) * 100) / 100
    : 0;

  const qlink = (over: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams({ p: cur?.id ?? "", sort, dir });
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (q) params.set("q", q);
    if (size !== 25) params.set("size", String(size));
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === "") params.delete(k); else params.set(k, String(v));
    }
    return `/erp/ledger?${params.toString()}`;
  };

  // header link: click toggles direction; active column gets the arrow
  const sortLink = (key: "date" | "dr" | "cr", label: string) => {
    const active = sort === key;
    const nextDir = active && dir === "desc" ? "asc" : "desc";
    const arrow = active ? (dir === "desc" ? " ▼" : " ▲") : "";
    return <Link href={qlink({ sort: key, dir: nextDir, pg: 1 })}
      style={{ color: "inherit", textDecoration: "none" }}>{label}{arrow}</Link>;
  };

  const balColor = bal >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)";

  return (
    <>
      <div className="tool">
        <LedgerPicker parties={P.map(x => ({ id: x.id, name: x.name, type: x.type }))} current={cur?.id ?? ""} />
        <span style={{ flex: 1 }} />
        <CsvBtn name="ledger.csv" rows={[["Date", "Day", "Particulars", "Ref", "Debit", "Credit"],
          ...sorted.map(r => [r.date, r.dow, r.part, r.no, r.dr || "", r.cr || ""])]} />
      </div>
      {cur ? (
        <div className="panel">
          <div className="ph">
            <div><h3>{cur.name}</h3>
              <div className="mut" style={{ fontSize: 12 }}>
                {cur.type} · {cur.mobile ?? ""} · {cur.state ?? ""}</div></div>
            <div style={{ textAlign: "right" }}>
              <div className="mut" style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: ".1em" }}>Closing</div>
              <b style={{ font: "600 20px var(--font-disp)", color: balColor }}>
                ₹{Math.abs(bal).toLocaleString("en-IN")} {bal >= 0 ? "Dr" : "Cr"}</b>
            </div>
          </div>

          <form method="get" style={{ display: "flex", gap: 8, flexWrap: "wrap",
            alignItems: "center", padding: "10px 16px 0" }}>
            <input type="hidden" name="p" value={cur.id} />
            <input type="hidden" name="sort" value={sort} />
            <input type="hidden" name="dir" value={dir} />
            <input className="inp mono" type="date" name="from" defaultValue={from} style={{ width: 140 }} />
            <span className="mut" style={{ fontSize: 12 }}>to</span>
            <input className="inp mono" type="date" name="to" defaultValue={to} style={{ width: 140 }} />
            <input className="inp" placeholder="Search ref / particulars…" defaultValue={q}
              style={{ maxWidth: 210 }} name="q" />
            <select className="inp" name="size" defaultValue={String(size)} style={{ width: 105 }}>
              {[25, 50, 100, 200, 500].map(n => <option key={n} value={n}>{n} / page</option>)}
            </select>
            <button className="btn sm" type="submit">Go</button>
            {(from || to || q) && <a className="btn sm" href={qlink({ from: "", to: "", q: "", pg: 1 })}>✕ Clear</a>}
          </form>

          <div className="tblw" style={{ marginTop: 10 }}><table className="t">
            <thead><tr>
              <th>{sortLink("date", "Date")}</th><th>Day</th><th>Particulars</th><th>Ref</th>
              <th className="num">{sortLink("dr", "Debit")}</th>
              <th className="num">{sortLink("cr", "Credit")}</th>
              <th className="num">Balance</th></tr></thead>
            <tbody>
              {from && sorted.length > 0 && startBal !== opening && dir === "asc" && (
                <tr>
                  <td>—</td><td></td>
                  <td><b>Brought forward (up to {from})</b></td><td />
                  <td className="num"></td><td className="num"></td>
                  <td className={"num " + (startBal >= 0 ? "pos" : "neg")} style={{ fontWeight: 700 }}>
                    ₹{Math.abs(startBal).toLocaleString("en-IN")} {startBal >= 0 ? "Dr" : "Cr"}</td>
                </tr>)}
              {view.map((r, i) => {
                const idx = (curPg - 1) * size + i;
                const run = runBalances[idx];
                const v = V.find(x => x.no === r.no && x.party_id === cur.id);
                return (
                  <tr key={`${r.no}-${i}`}>
                    <td className="mono" style={{ fontSize: 11.5 }}>{r.date}</td>
                    <td className="mut" style={{ fontSize: 11 }}>{r.dow}</td>
                    <td>{r.part}</td>
                    <td className="mono" style={{ fontSize: 11.5 }}>
                      {v ? <b className="linkish" data-voucher={v.id}>{r.no}</b> : r.no}
                    </td>
                    <td className="num">{r.dr ? "₹" + r.dr.toLocaleString("en-IN") : ""}</td>
                    <td className="num">{r.cr ? "₹" + r.cr.toLocaleString("en-IN") : ""}</td>
                    <td className={"num " + (run >= 0 ? "pos" : "neg")} style={{ fontWeight: 700 }}>
                      ₹{Math.abs(run).toLocaleString("en-IN")} {run >= 0 ? "Dr" : "Cr"}</td>
                  </tr>);
              })}
              {!sorted.length && <tr><td colSpan={7}><div className="empty">
                {all.length ? "No entries match the filters." : "No transactions."}</div></td></tr>}
            </tbody>
          </table></div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "10px 16px 12px" }}>
            <span className="mut" style={{ fontSize: 12 }}>
              {sorted.length
                ? `Showing ${(curPg - 1) * size + 1}–${Math.min(curPg * size, sorted.length)} of ${sorted.length} entries`
                : "Nothing to show"}
            </span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Link className={"btn sm" + (curPg <= 1 ? " dis" : "")} aria-disabled={curPg <= 1}
                href={qlink({ pg: curPg > 1 ? curPg - 1 : undefined })}>← Prev</Link>
              <span className="mut" style={{ fontSize: 12 }}>Page {curPg} / {pages}</span>
              <Link className={"btn sm" + (curPg >= pages ? " dis" : "")} aria-disabled={curPg >= pages}
                href={qlink({ pg: curPg < pages ? curPg + 1 : undefined })}>Next →</Link>
            </div>
          </div>
        </div>
      ) : <div className="empty">No parties yet.</div>}
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