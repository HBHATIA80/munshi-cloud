"use client";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateMoneyVoucherAction, deleteVoucherAction } from "@/sections/invoicing/actions";

export function MoneyVoucherModal({ voucherId, kind, onClose, onSaved }: {
  voucherId: string; kind: "receipt" | "payment" | "journal";
  onClose: () => void; onSaved: (no: string) => void }) {
  const [v, setV] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("cash");
  const [date, setDate] = useState("");
  const [narr, setNarr] = useState("");
  const [err, setErr] = useState("");
  const [saving, start] = useTransition();
    const handlers: Array<[Element, (e: Event) => void]> = [];
  useEffect(() => {
    const sb = createClient();
    sb.from("vouchers").select("*").eq("id", voucherId).single().then(({ data }) => {
      if (data) {
        setV(data); setAmount(String(+data.total)); setMode(data.mode ?? "cash");
        setDate(data.date ?? ""); setNarr(data.narr ?? "");
      } else setErr("Voucher not found");
    });
  }, [voucherId]);

  if (err) return <Shell onClose={onClose}><p className="neg">{err}</p></Shell>;
  if (!v) return <Shell onClose={onClose}><div className="empty">Loading…</div></Shell>;

  const save = () => start(async () => {
    setErr("");
    const r = await updateMoneyVoucherAction(fd());
    if (r.error) setErr(r.error); else onSaved(r.no!);
  });
  const fd = () => {
    const f = new FormData();
    f.set("id", voucherId); f.set("amount", amount); f.set("mode", mode);
    f.set("date", date); f.set("narr", narr); f.set("kind", kind);
    return f;
  };

  return (
    <Shell onClose={onClose}>
      <h3 style={{ marginBottom: 4 }}>Edit {kind} — <span className="mono">{v.no}</span></h3>
      <p className="mut" style={{ fontSize: 12, marginBottom: 12 }}>
        {kind === "journal"
          ? "Journal transfers have two linked legs. Amount and date changes apply to BOTH parties automatically."
          : "Changes re-apply to the party ledger automatically. FIFO adjustments made on posting are part of the note — edit the note too if needed."}</p>
      <div className="frm">
        <div><label className="fl">Amount *</label>
          <input className="inp mono" type="number" min="0" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)} /></div>
        <div><label className="fl">Mode</label>
          <select className="inp" value={mode} onChange={e => setMode(e.target.value)}>
            {["cash", "upi", "bank", "cheque", "journal"].map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div><label className="fl">Date</label>
          <input className="inp mono" type="date" value={date}
            onChange={e => setDate(e.target.value)} /></div>
        <div className="full"><label className="fl">Note</label>
          <input className="inp" value={narr} onChange={e => setNarr(e.target.value)} /></div>
      </div>
      {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <button className="btn dng" disabled={saving}
          onClick={() => {
            if (!window.confirm("Delete this voucher? Both journal legs (if any) are removed and ledgers update.")) return;
            start(async () => {
              const rr = await deleteVoucherAction(voucherId);
              if (rr.error) setErr(rr.error); else onSaved(v.no);
            });
          }}>🗑 Delete</button>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}</button>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 85, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 480, maxWidth: "100%", padding: 22 }}>{children}</div>
    </div>
  );
}