"use client";
import { useMemo, useState, useTransition } from "react";
import { partyJournalAction } from "@/sections/invoicing/actions";
import { LiveSearch } from "@/components/LiveSearch";
import { showAlert } from "@/components/Alert";
import { CsvBtn } from "@/lib/CsvBtn";

type P = { id: string; name: string; type: string };
type H = { no: string; date: string; party_id: string | null; total: number; narr: string | null };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/* ---------- one transfer = the A/B leg pair of a journal (same base number) ---------- */
type Tx = {
  base: string; date: string; amount: number;
  fromId: string | null; toId: string | null;
  narr: string; complete: boolean;
};

function groupTxs(history: H[]): Tx[] {
  const byBase = new Map<string, { a?: H; b?: H }>();
  for (const h of history) {
    const base = h.no.replace(/-[AB]$/, "");
    const slot = byBase.get(base) ?? {};
    if (h.no.endsWith("-A")) slot.a = h;
    else if (h.no.endsWith("-B")) slot.b = h;
    byBase.set(base, slot);
  }
  const txs: Tx[] = [];
  for (const [base, s] of byBase) {
    txs.push({
      base,
      date: s.a?.date ?? s.b?.date ?? "",
      amount: +(s.a?.total ?? s.b?.total ?? 0),
      fromId: s.a?.party_id ?? null,
      toId: s.b?.party_id ?? null,
      narr: s.a?.narr ?? s.b?.narr ?? "",
      complete: !!(s.a && s.b),
    });
  }
  txs.sort((x, y) => (y.date + y.base).localeCompare(x.date + x.base)); // newest first
  return txs;
}

export function PartyJournal({ parties, history }: { parties: P[]; history: H[] }) {
  const [pending, start] = useTransition();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const nameOf = (id: string | null) => parties.find(p => p.id === id)?.name ?? "—";

  /* history: filters + pagination state */
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [q, setQ] = useState("");
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);

  const txs = useMemo(() => groupTxs(history), [history]);

  const filtered = useMemo(() => {
    const nm = (id: string | null) => parties.find(p => p.id === id)?.name ?? "—";
    const needle = q.trim().toLowerCase();
    return txs.filter(t => {
      if (fFrom && t.date && t.date < fFrom) return false;
      if (fTo && t.date && t.date > fTo) return false;
      if (needle) {
        const hay = (t.base + " " + nm(t.fromId) + " " + nm(t.toId) + " " + (t.narr ?? "")).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [txs, fFrom, fTo, q, parties]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * size, cur * size);
  const hasFilter = !!(fFrom || fTo || q);

  const post = () => {
    const fd = new FormData();
    fd.set("from_party", fromId);
    fd.set("to_party", toId);
    fd.set("amount", amount);
    start(async () => {
      const r = await partyJournalAction(fd);
      if (r.error) showAlert("Transfer failed", r.error, "❌");
      else location.reload();
    });
  };

  return (
    <>
      <div className="panel">
        <div className="ph"><h3>Party ↔ Party transfer</h3></div>
        <div className="pb">
          <div className="frm" style={{ gridTemplateColumns: "1fr auto 1fr 1fr", gap: 10 }}>
            <div>
              <label className="fl">From party *</label>
              <LiveSearch items={parties} getLabel={p => p.name} getSub={p => p.type}
                placeholder="Type to search…" selectedId={fromId || undefined}
                onPick={p => setFromId(p?.id ?? "")} />
            </div>
            <div style={{ alignSelf: "end", textAlign: "center", fontWeight: 700, paddingBottom: 8 }}>→</div>
            <div>
              <label className="fl">To party *</label>
              <LiveSearch items={parties} getLabel={p => p.name} getSub={p => p.type}
                placeholder="Type to search…" selectedId={toId || undefined}
                onPick={p => setToId(p?.id ?? "")} />
            </div>
            <div>
              <label className="fl">Amount *</label>
              <input className="inp mono" type="number" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} />
              <button className="btn pri" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                disabled={pending || !fromId || !toId || !(+amount > 0) || fromId === toId}
                onClick={post}>
                {pending ? "Posting…" : "Post transfer"}</button>
            </div>
          </div>
          <p className="mut" style={{ fontSize: 12, marginTop: 10 }}>
            From party is <b>Debited</b> (balance decreases), To party is <b>Credited</b>
            (balance increases). E.g. to move what you owe from supplier A to supplier B,
            pick A as From and B as To. Both legs delete and edit together.</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="ph">
          <h3>Journal history</h3>
          <span className="mut" style={{ fontSize: 12 }}>
            One line per transfer · newest first · {filtered.length} of {txs.length}
          </span>
        </div>

        {/* filter bar */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", padding: "10px 12px 0" }}>
          <input className="inp mono" type="date" value={fFrom} style={{ width: 140 }}
            onChange={e => { setFFrom(e.target.value); setPage(1); }} />
          <span className="mut" style={{ fontSize: 12 }}>to</span>
          <input className="inp mono" type="date" value={fTo} style={{ width: 140 }}
            onChange={e => { setFTo(e.target.value); setPage(1); }} />
          <input className="inp" placeholder="Search party, voucher no, note…" value={q}
            style={{ maxWidth: 230 }}
            onChange={e => { setQ(e.target.value); setPage(1); }} />
          <select className="inp" value={size} style={{ width: 105 }}
            onChange={e => { setSize(+e.target.value); setPage(1); }}>
            {[10, 25, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
          </select>
          {hasFilter && (
            <button className="btn sm"
              onClick={() => { setFFrom(""); setFTo(""); setQ(""); setPage(1); }}>✕ Clear</button>
          )}
          <span style={{ flex: 1 }} />
          <CsvBtn name="journals.csv" rows={[
            ["No", "Date", "From (Dr)", "To (Cr)", "Amount", "Note"],
            ...filtered.map(t => [t.base, t.date, nameOf(t.fromId), nameOf(t.toId), t.amount, t.narr]),
          ]} />
        </div>

        <div className="tblw" style={{ marginTop: 8 }}>
          <table className="t">
            <thead><tr>
              <th>No</th><th>Date</th><th>Transfer detail</th><th className="num">Amount</th>
            </tr></thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.base} title={t.narr || undefined}>
                  <td className="mono"><b>{t.base}</b></td>
                  <td>{t.date}</td>
                  <td>
                    {t.complete
                      ? <><b>Dr</b> {nameOf(t.fromId)} <span className="mut">→</span> <b>Cr</b> {nameOf(t.toId)}</>
                      : <><b>{t.fromId ? "Dr" : "Cr"}</b> {nameOf((t.fromId ?? t.toId)!)}
                          <span className="chip red" style={{ marginLeft: 8 }}>pair incomplete</span></>}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{inr(t.amount)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={4}><div className="empty">
                  {txs.length ? "No transfers match the current filters." : "No journals yet."}
                </div></td></tr>)}
            </tbody>
          </table>
        </div>

        {/* pagination */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 12px 12px" }}>
          <span className="mut" style={{ fontSize: 12 }}>
            {filtered.length
              ? `Showing ${(cur - 1) * size + 1}–${Math.min(cur * size, filtered.length)} of ${filtered.length}`
              : "Nothing to show"}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <button className="btn sm" disabled={cur <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}>← Prev</button>
            <span className="mut" style={{ fontSize: 12 }}>Page {cur} / {pages}</span>
            <button className="btn sm" disabled={cur >= pages}
              onClick={() => setPage(p => Math.min(pages, p + 1))}>Next →</button>
          </div>
        </div>
      </div>
    </>
  );
}