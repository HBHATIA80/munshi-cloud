"use client";
import { useState, useTransition } from "react";
import { savePartyAction, deletePartyAction } from "./actions";
import { showAlert, showConfirm } from "@/components/Alert";

type Row = { id: string; name: string; type: string; mobile: string | null;
  state: string | null; gstin: string; addr: string;
  open: number; balance: number; appLinked: boolean };

const inr = (n: number) => "₹" + Math.round(Math.abs(n)).toLocaleString("en-IN");

function downloadCsv(name: string, rows: (string | number)[][]) {
  const q = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = rows.map(r => r.map(q).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
}

export function PartiesView({ rows, cap, used }: {
  rows: Row[]; cap: number; used: number }) {
  const [q, setQ] = useState("");
  const [typeF, setTypeF] = useState("all");
  const [size, setSize] = useState(15);
  const [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Row | "new" | null>(null);
  const [pending, start] = useTransition();

  const list = rows.filter(r =>
    (typeF === "all" || r.type === typeF ||
      (typeF === "customer" && r.type === "retailer")) &&
    (!q || r.name.toLowerCase().includes(q.toLowerCase()) ||
      (r.mobile ?? "").includes(q) || (r.gstin ?? "").toLowerCase().includes(q.toLowerCase())));

  const pages = Math.max(1, Math.ceil(list.length / size));
  const cur = Math.min(page, pages);
  const view = list.slice((cur - 1) * size, cur * size);

  return (
    <>
      <div className="tool">
        <input className="inp" style={{ maxWidth: 260 }} placeholder="Search name / mobile / GSTIN…"
          value={q} onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select className="inp" style={{ width: 150 }} value={typeF}
          onChange={e => { setTypeF(e.target.value); setPage(1); }}>
          <option value="all">All parties</option>
          <option value="customer">Customers</option>
          <option value="shopkeeper">Shopkeepers</option>
          <option value="supplier">Suppliers</option>
        </select>
        <select className="inp" style={{ width: 105 }} value={size}
          onChange={e => { setSize(+e.target.value); setPage(1); }}>
          {[15, 30, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <span className="chip" title="Customer limit for your plan">
          Customers {used}/{cap}</span>
        <span style={{ flex: 1 }} />
        <button className="btn" onClick={() => downloadCsv("parties.csv", [
          ["Name", "Type", "Mobile", "State", "GSTIN", "Balance", "Side", "App-linked", "Address"],
          ...list.map(r => [r.name, r.type, r.mobile ?? "", r.state ?? "", r.gstin,
            Math.abs(r.balance), r.balance >= 0 ? "Dr" : "Cr", r.appLinked ? "yes" : "", r.addr]),
        ])}>⭳ CSV</button>
        <button className="btn pri" onClick={() => setEdit("new")}>＋ New party</button>
      </div>

      <div className="panel"><div className="tblw"><table className="t">
        <thead><tr><th>Party</th><th>Type</th><th>Mobile</th><th>State</th>
          <th className="num">Balance</th><th /></tr></thead>
        <tbody>
          {view.map(r => (
            <tr key={r.id}>
              <td>
                <b>{r.name}</b>
                {r.appLinked && <span className="chip grn" style={{ marginLeft: 6 }}>app</span>}
                <div className="mut" style={{ fontSize: 10.5 }}>{r.addr || ""}</div>
              </td>
              <td><span className={"chip " + (r.type === "supplier" ? "amb" : r.type === "shopkeeper" ? "blu" : "")}>
                {r.type}</span></td>
              <td className="mono" style={{ fontSize: 11.5 }}>{r.mobile || "—"}</td>
              <td className="mut">{r.state || "—"}</td>
                            <td className="num" style={{ fontWeight: 700,
                color: r.balance >= 0 ? "var(--green, #1a7f37)" : "var(--red, #c62828)" }}>
                {inr(r.balance)} {r.balance >= 0 ? "Dr" : "Cr"}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                <button className="ib" title="Edit" onClick={() => setEdit(r)}>✎</button>
                {!r.appLinked && r.mobile && (
                  <button className="ib" title="Invite on WhatsApp"
                    onClick={() => {
                      const mob = r.mobile!.replace(/\D/g, "").slice(-10);
                      const txt = `Join our shop on MunshiCloud! 🙏\n` +
                        `1. Sign up at ${window.location.origin}/signup with your mobile number ${r.mobile}\n` +
                        `2. Ask us for our shop code and enter it in your portfolio\n` +
                        `Then see your ledger, invoices & order online anytime.`;
                      window.open(`https://wa.me/91${mob}?text=${encodeURIComponent(txt)}`, "_blank");
                    }}>📲</button>)}
                <button className="ib" title="Delete" disabled={pending}
                  onClick={() => start(async () => {
                    if (await showConfirm("Delete party", `Delete "${r.name}"?`)) {
                      const e = await deletePartyAction(r.id);
                      if (e.error) showAlert("Delete failed", e.error, "❌");
                      else location.reload();
                    }
                  })}>🗑</button>
              </td></tr>))}
          {!list.length && <tr><td colSpan={6}><div className="empty">No parties found.</div></td></tr>}
        </tbody>
      </table></div></div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10 }}>
        <span className="mut" style={{ fontSize: 12 }}>
          {list.length
            ? `Showing ${(cur - 1) * size + 1}–${Math.min(cur * size, list.length)} of ${list.length}`
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

      {edit && <PartyForm row={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </>
  );
}

function PartyForm({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [type, setType] = useState(row?.type ?? "customer");
  const submit = (fd: FormData) => {
    if (row) fd.set("id", row.id);
    fd.set("type", type);
    start(async () => {
      setErr("");
      const r = await savePartyAction(fd);
      if (r.error) setErr(r.error); else onClose();
    });
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 540, maxWidth: "100%", padding: 20 }}>
        <h3 style={{ marginBottom: 14 }}>{row ? "Edit party" : "New party"}</h3>
        <form action={submit}>
          <div className="frm">
            <div className="full"><label className="fl">Name *</label>
              <input className="inp" name="name" defaultValue={row?.name ?? ""} required /></div>
            <div><label className="fl">Type</label>
              <select className="inp" name="type" value={type}
                onChange={e => setType(e.target.value)}
                disabled={!!row?.appLinked}
                title={row?.appLinked ? "App-linked — change their role from Users & Roles" : ""}>
                <option value="customer">Customer</option>
                <option value="shopkeeper">Customer · Shopkeeper (B2B trade)</option>
                <option value="supplier">Supplier</option>
              </select></div>
            <div><label className="fl">Mobile</label>
              <input className="inp mono" name="mobile" maxLength={12} defaultValue={row?.mobile ?? ""} /></div>
            <div><label className="fl">State (for IGST)</label>
              <input className="inp" name="state" defaultValue={row?.state ?? ""} /></div>
            <div><label className="fl">GSTIN</label>
              <input className="inp mono" name="gstin" defaultValue={row?.gstin ?? ""} /></div>
            <div><label className="fl">Opening balance (they owe you)</label>
              <input className="inp mono" name="open" type="number" step="0.01"
                defaultValue={row ? row.open : 0}
                disabled={!!row?.appLinked}
                title={row?.appLinked ? "App-linked customer — balance is managed by their transactions" : ""} /></div>
            <div className="full"><label className="fl">Address</label>
              <input className="inp" name="addr" defaultValue={row?.addr ?? ""} /></div>
          </div>
          {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn pri" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}