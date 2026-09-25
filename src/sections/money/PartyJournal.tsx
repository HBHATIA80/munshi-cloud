"use client";
import { useMemo, useState, useTransition } from "react";
import { partyJournalAction, updateMoneyVoucherAction } from "@/sections/invoicing/actions";
import { LiveSearch } from "@/components/LiveSearch";
import { showAlert } from "@/components/Alert";
import { CsvBtn } from "@/lib/CsvBtn";

type P = { id: string; name: string; type: string };
type H = { id?: string; no: string; date: string; party_id: string | null; total: number; narr: string | null };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/* one transfer = the A/B leg pair of a journal (same base number) */
type Tx = {
  base: string; date: string; amount: number;
  fromId: string | null; toId: string | null; narr: string; complete: boolean;
};

export function PartyJournal({ parties, history }: { parties: P[]; history: H[] }) {
  const [pending, start] = useTransition();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [amount, setAmount] = useState("");
  const [jDate, setJDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const nameOf = (id: string | null) => parties.find(p => p.id === id)?.name ?? "—";

  /* history: filters + pagination */
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");
  const [q, setQ] = useState("");
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(1);

  const txs = useMemo<Tx[]>(() => {
    const byBase = new Map<string, { a?: H; b?: H }>();
    for (const h of history) {
      const base = h.no.replace(/-[AB]$/, "");
      const slot = byBase.get(base) ?? {};
      if (h.no.endsWith("-A")) slot.a = h;
      else if (h.no.endsWith("-B")) slot.b = h;
      byBase.set(base, slot);
    }
    const out: Tx[] = [];
    for (const [base, s] of byBase) {
      out.push({
        base,
        date: s.a?.date ?? s.b?.date ?? "",
        amount: +(s.a?.total ?? s.b?.total ?? 0),
        fromId: s.a?.party_id ?? null, toId: s.b?.party_id ?? null,
        narr: s.a?.narr ?? s.b?.narr ?? "",
        complete: !!(s.a && s.b),
      });
    }
    out.sort((x, y) => (y.date + y.base).localeCompare(x.date + x.base));
    return out;
  }, [history]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return txs.filter(t => {
      if (fFrom && t.date && t.date < fFrom) return false;
      if (fTo && t.date && t.date > fTo) return false;
      if (needle) {
        const hay = (t.base + " " + nameOf(t.fromId) + " " + nameOf(t.toId)
          + " " + (t.narr ?? "")).toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [txs, fFrom, fTo, q, parties]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const rows = filtered.slice((cur - 1) * size, cur * size);
  const hasFilter = !!(fFrom || fTo || q);

  /* edit modal state */
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [eAmount, setEAmount] = useState("");
  const [eDate, setEDate] = useState("");
  const [eNote, setENote] = useState("");

  const openEdit = (t: Tx) => {
    setEditTx(t); setEAmount(String(t.amount)); setEDate(t.date); setENote(t.narr);
  };

  const saveEdit = () => start(async () => {
    if (!editTx) return;
    const legId = editTx.fromId
      ? (history.find(h => h.no === editTx.base + "-A") as H | undefined)?.id
      : (history.find(h => h.no === editTx.base + "-B") as H | undefined)?.id;
    if (!legId) { showAlert("Edit failed", "Leg id missing — refresh the page.", "❌"); return; }
    const fd = new FormData();
    fd.set("id", legId);
    fd.set("amount", eAmount);
    fd.set("date", eDate);
    fd.set("narr", eNote);
    fd.set("kind", "journal");
    fd.set("mode", "journal");
    const r = await updateMoneyVoucherAction(fd);
    if (r.error) showAlert("Edit failed", r.error, "❌");
    else location.reload();
  });

  const post = () => {
    const fd = new FormData();
    fd.set("from_party", fromId);
    fd.set("to_party", toId);
    fd.set("amount", amount);
    fd.set("date", jDate);
    fd.set("narr", note);
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
          <div className="frm" style={{ gridTemplateColumns: "1fr auto 1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label className="fl">From party * (who pays on our behalf)</label>
              <LiveSearch items={parties} getLabel={p => p.name} getSub={p => p.type}
                placeholder="Type to search…" selectedId={fromId || undefined}
                onPick={p => setFromId(p?.id ?? "")} />
            </div>
            <div style={{ alignSelf: "end", textAlign: "center", fontWeight: 700, paddingBottom: 8 }}>→</div>
            <div>
              <label className="fl">To party * (who gets settled)</label>
              <LiveSearch items={parties} getLabel={p => p.name} getSub={p => p.type}
                placeholder="Type to search…" selectedId={toId || undefined}
                onPick={p => setToId(p?.id ?? "")} />
            </div>
            <div>
              <label className="fl">Amount *</label>
              <input className="inp mono" type="number" min="0" step="0.01"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="fl">Date</label>
              <input className="inp mono" type="date" value={jDate}
                onChange={e => setJDate(e.target.value)} />
              <button className="btn pri" style={{ marginTop: 8, width: "100%", justifyContent: "center" }}
                disabled={pending || !fromId || !toId || !(+amount > 0) || fromId === toId}
                onClick={post}>
                {pending ? "Posting…" : "Post transfer"}</button>
            </div>
            <div className="full">
              <label className="fl">Note (optional — saved on both legs)</label>
              <input className="inp" value={note} onChange={e => setNote(e.target.value)}
                placeholder="e.g. Balance shifted on supplier request" />
            </div>
          </div>
          <p className="mut" style={{ fontSize: 12, marginTop: 10 }}>
            <b>From</b> = the party who pays on our behalf → <b>Credited</b> (a customer who owed you
            owes less; e.g. Inderpuri paying your supplier). <b>To</b> = the party who receives →
            <b> Debited</b> (what we owe them decreases; e.g. Paras getting settled). Both legs edit
            and delete together.</p>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="ph">
          <h3>Journal history</h3>
          <span className="mut" style={{ fontSize: 12 }}>
            One line per transfer · newest first · {filtered.length} of {txs.length}
          </span>
        </div>

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
            ["No", "Date", "From (Cr - paid)", "To (Dr - received)", "Amount", "Note"],
            ...filtered.map(t => [t.base, t.date, nameOf(t.fromId), nameOf(t.toId), t.amount, t.narr]),
          ]} />
        </div>

        <div className="tblw" style={{ marginTop: 8 }}>
          <table className="t">
            <thead><tr>
              <th>No</th><th>Date</th><th>Transfer detail</th><th className="num">Amount</th><th>Note</th><th />
            </tr></thead>
            <tbody>
              {rows.map(t => (
                <tr key={t.base}>
                  <td className="mono"><b>{t.base}</b></td>
                  <td>{t.date}</td>
                  <td>
                    {t.complete
                      ? <><b>Cr</b> {nameOf(t.fromId)} <span className="mut">→</span> <b>Dr</b> {nameOf(t.toId)}</>
                      : <><b>{t.fromId ? "Cr" : "Dr"}</b> {nameOf((t.fromId ?? t.toId)!)}
                          <span className="chip red" style={{ marginLeft: 8 }}>pair incomplete</span></>}
                  </td>
                  <td className="num" style={{ fontWeight: 700 }}>{inr(t.amount)}</td>
                  <td className="mut" style={{ fontSize: 11.5, maxWidth: 260 }}>
                    {t.narr || "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="ib" title="Edit (updates both legs)"
                      onClick={() => openEdit(t)}>✎</button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6}><div className="empty">
                  {txs.length ? "No transfers match the current filters." : "No journals yet."}
                </div></td></tr>)}
            </tbody>
          </table>
        </div>

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

      {editTx && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 92, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setEditTx(null); }}>
          <div className="panel" style={{ width: 460, maxWidth: "100%", padding: 20 }}>
            <h3 style={{ marginBottom: 4 }}>Edit journal — <span className="mono">{editTx.base}</span></h3>
            <p className="mut" style={{ fontSize: 12, marginBottom: 12 }}>
              Amount, date and note apply to <b>both legs</b> automatically.</p>
            <div className="frm">
              <div><label className="fl">Amount *</label>
                <input className="inp mono" type="number" min="0" step="0.01" value={eAmount}
                  onChange={e => setEAmount(e.target.value)} /></div>
              <div><label className="fl">Date</label>
                <input className="inp mono" type="date" value={eDate}
                  onChange={e => setEDate(e.target.value)} /></div>
              <div className="full"><label className="fl">Note</label>
                <input className="inp" value={eNote} onChange={e => setENote(e.target.value)} /></div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button className="btn" onClick={() => setEditTx(null)}>Cancel</button>
              <button className="btn pri" disabled={pending} onClick={saveEdit}>
                {pending ? "Saving…" : "Save both legs"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}