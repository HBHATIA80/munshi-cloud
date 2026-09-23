"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { deleteVoucherAction, getVoucherAction, editNoAction } from "./actions";
import { EditVoucher } from "./EditVoucher";

/* ================= types & helpers ================= */

type Row = {
  id: string; no: string; date: string; party: string;
  taxable: number; tax: number; total: number; paid: number; is_gst: boolean;
};

const inr = (n: number) =>
  "₹" + Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g,
  c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

function dmy(d: string) {
  if (!d) return "";
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const p = String(d).split("-");
  return p.length === 3 ? `${p[2]} ${MON[+p[1] - 1]} ${p[0].slice(2)}` : String(d);
}

function inWords(n: number) {
  n = Math.round(Math.abs(Number(n) || 0));
  if (!n) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => (x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : ""));
  const three = (x: number) => Math.floor(x / 100)
    ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x);
  let s = "";
  const cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) s += three(cr) + " Crore ";
  if (lk) s += three(lk) + " Lakh ";
  if (th) s += three(th) + " Thousand ";
  if (n) s += three(n);
  return s.trim();
}

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

/* ================= register table ================= */

export function RegistersView({ rows, kind, editableNo }: {
  rows: Row[]; kind: "sale" | "purchase"; editableNo?: boolean;
}) {
  const [viewId, setViewId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [noEdit, setNoEdit] = useState<{ id: string; no: string } | null>(null);
  const [pending, start] = useTransition();
  const [q, setQ] = useState("");
  const [size, setSize] = useState(15);
  const [page, setPage] = useState(1);

  const ql = q.trim().toLowerCase();
  const filtered = ql
    ? rows.filter(r => (r.no + " " + r.party).toLowerCase().includes(ql))
    : rows;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const view = filtered.slice((cur - 1) * size, cur * size);

  const del = (id: string, no: string) => start(async () => {
    if (!window.confirm(`Delete ${no}? Stock reverses automatically and ledgers update.`)) return;
    const r = await deleteVoucherAction(id);
    if (r.error) window.alert("Delete failed: " + r.error);
    else location.reload();
  });

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8,
        marginBottom: 10, flexWrap: "wrap" }}>
        <input className="inp" placeholder="Search no / party…" value={q} style={{ maxWidth: 200 }}
          onChange={e => { setQ(e.target.value); setPage(1); }} />
        <select className="inp" value={size} style={{ width: 105 }}
          onChange={e => { setSize(+e.target.value); setPage(1); }}>
          {[15, 30, 50, 100].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
        <button className="btn" onClick={() => downloadCsv(kind + "-register.csv", [
          ["No", "Date", "Party", "Taxable", "GST", "Total", "Paid", "Due"],
          ...filtered.map(r => [r.no, r.date, r.party, r.taxable,
            r.is_gst ? r.tax : 0, r.total, r.paid, r.total - r.paid]),
        ])}>⭳ CSV</button>
      </div>

      {filtered.length > 0 ? (
        <div className="tblw">
          <table className="t">
            <thead>
              <tr>
                <th>No</th><th>Date</th><th>Party</th>
                <th className="num">Taxable</th><th className="num">GST</th>
                <th className="num">Total</th><th className="num">Paid</th>
                <th className="num">Due</th><th>Type</th><th />
              </tr>
            </thead>
            <tbody>
              {view.map(r => {
                const due = Math.round((r.total - r.paid) * 100) / 100;
                return (
                  <tr key={r.id}>
                    <td className="mono">
                      {editableNo
                        ? <b className="linkish" style={{ cursor: "pointer" }}
                            title="Click to correct the voucher number"
                            onClick={() => setNoEdit({ id: r.id, no: r.no })}>{r.no}</b>
                        : <b>{r.no}</b>}
                    </td>
                    <td>{dmy(r.date)}</td>
                    <td>{esc(r.party) || "Cash / Counter"}</td>
                    <td className="num">{inr(r.taxable)}</td>
                    <td className="num">{r.is_gst ? inr(r.tax) : "—"}</td>
                    <td className="num"><b>{inr(r.total)}</b></td>
                    <td className="num">
                      {due <= 0
                        ? <span className="chip grn">Paid</span>
                        : r.paid > 0
                          ? <span className="chip amb">{inr(r.paid)}</span>
                          : <span className="chip red">Unpaid</span>}
                    </td>
                    <td className="num neg">{due > 0 ? inr(due) : "—"}</td>
                    <td>{r.is_gst
                      ? <span className="chip grn">GST</span>
                      : <span className="chip">Non-GST</span>}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="ib" title="View" onClick={() => setViewId(r.id)}>👁</button>
                      <button className="ib" title="Edit" onClick={() => setEditId(r.id)}>✎</button>
                      <button className="ib" title="Delete" disabled={pending}
                        onClick={() => del(r.id, r.no)}>🗑</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty" style={{ padding: 28, textAlign: "center" }}>
          {rows.length ? "No rows match the search." : "Nothing posted in this period yet."}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10 }}>
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

      {viewId && <VoucherModal id={viewId} onClose={() => setViewId(null)} />}
      {editId && (
        <EditVoucher
          voucherId={editId}
          kind={kind}
          onClose={() => setEditId(null)}
          onSaved={() => location.reload()}
        />
      )}
      {noEdit && (
        <EditNoModal
          id={noEdit.id}
          current={noEdit.no}
          onClose={() => setNoEdit(null)}
          onSaved={() => { setNoEdit(null); location.reload(); }}
        />
      )}
    </>
  );
}

/* ---------- popup: correct the voucher NUMBER ---------- */
function EditNoModal({ id, current, onClose, onSaved }: {
  id: string; current: string; onClose: () => void; onSaved: () => void;
}) {
  const [no, setNo] = useState(current);
  const [err, setErr] = useState("");
  const [saving, start] = useTransition();

  const save = () => start(async () => {
    setErr("");
    const fd = new FormData();
    fd.set("id", id);
    fd.set("no", no.trim());
    const r = await editNoAction(fd);
    if (r.error) setErr(r.error);
    else onSaved();
  });

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 90, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 420, maxWidth: "100%", padding: 20 }}>
        <h3 style={{ marginBottom: 6 }}>Correct voucher number</h3>
        <p className="mut" style={{ fontSize: 12, marginBottom: 12 }}>
          Fix typos in the printed number. Auto-numbering is unaffected —
          future vouchers keep incrementing.</p>
        <label className="fl">Voucher number</label>
        <input className="inp mono" value={no} onChange={e => setNo(e.target.value)} />
        {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn pri" disabled={saving || !no.trim()} onClick={save}>
            {saving ? "Saving…" : "Save number"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= VOUCHER VIEW MODAL ================= */
export function VoucherModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [data, setData] = useState<{ v: any; party: any; tenant: any; receipts?: any[] } | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let live = true;
    getVoucherAction(id).then(d => {
      if (live) { if (d) setData(d as any); else setErr("Voucher not found."); }
    });
    return () => { live = false; };
  }, [id]);

  if (err) return <Shell onClose={onClose}><p className="neg">{err}</p></Shell>;
  if (!data) return <Shell onClose={onClose}><div className="empty">Loading…</div></Shell>;

  const v = data.v;
  const party = data.party;
  const tenant = data.tenant;
  const receipts = (data.receipts ?? []) as any[];
  const vLines = (Array.isArray(v.lines) ? v.lines : []) as any[];
  const isSale = v.type === "sale";
  const inter = !!(v.is_gst && party?.state && tenant?.state && party.state !== tenant.state);
  const due = Math.round((v.total - (v.paid ?? 0)) * 100) / 100;
  const partyLabel = v.type === "purchase" ? "Supplier"
    : v.type === "payment" ? "Paid to" : "Billed to";
  const title = v.type === "sale" ? "Tax Invoice"
    : v.type === "purchase" ? "Purchase Bill"
    : v.type === "salret" ? "Credit Note"
    : v.type === "purret" ? "Debit Note"
    : v.type === "receipt" ? "Receipt Voucher"
    : v.type === "payment" ? "Payment Voucher" : String(v.type);

  return (
    <Shell onClose={onClose}>
      {/* letterhead */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
        flexWrap: "wrap", paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
        <div>
          <b style={{ fontSize: 20 }}>{tenant?.name}</b>
          <div className="mut" style={{ fontSize: 11.5, marginTop: 2 }}>
            {tenant?.addr}<br />{tenant?.phone}
            {tenant?.gstin ? <> · GSTIN {tenant.gstin}</> : null}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={"chip " + (isSale ? "grn" : v.type === "purchase" ? "amb" : "")}
            style={{ fontSize: 11 }}>{String(title).toUpperCase()}</span>
          <div className="mono" style={{ fontWeight: 700, fontSize: 15, marginTop: 6 }}>{v.no}</div>
          <div className="mut" style={{ fontSize: 12 }}>Date: {v.date}</div>
        </div>
      </div>

      {/* parties bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12,
        padding: "12px 0", borderBottom: "1px solid var(--line)" }}>
        <div>
          <div className="fl">{partyLabel}</div>
          <b>{party?.name || "Cash / Counter"}</b>
          <div className="mut" style={{ fontSize: 11.5, marginTop: 2 }}>
            {party?.state && <>📍 {party.state} · </>}
            {party?.gstin ? <>GSTIN {party.gstin}</> : (!party?.state ? "—" : null)}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="fl">Bill reference</div>
          <b className="mono">{v.ref || "—"}</b>
          <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>
            {vLines.length === 0 ? "Money voucher"
              : v.is_gst ? (inter ? "IGST (inter-state)" : "CGST + SGST (intra-state)")
              : "Non-GST bill"}
          </div>
        </div>
      </div>

      {/* items */}
      {vLines.length > 0 && (
        <div className="tblw" style={{ marginTop: 4 }}>
          <table className="t">
            <thead>
              <tr>
                <th>#</th><th>Item</th><th>HSN</th>
                <th className="num">Qty</th><th className="num">Rate</th>
                <th className="num">Taxable</th>
                {v.is_gst && <th className="num">GST</th>}
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {vLines.map((l: any, i: number) => {
                const net = l._net != null ? Number(l._net)
                  : Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;
                const tx = l._tax != null ? Number(l._tax)
                  : (v.is_gst ? Math.round(net * (l.gst || 0) / 100 * 100) / 100 : 0);
                return (
                  <tr key={i}>
                    <td className="mut">{i + 1}</td>
                    <td><b>{l.name}</b></td>
                    <td className="mono" style={{ fontSize: 10.5 }}>{l.hsn || "—"}</td>
                    <td className="num">{l.qty}</td>
                    <td className="num">{inr(l.rate)}</td>
                    <td className="num">{inr(net)}</td>
                    {v.is_gst && <td className="num">{inr(tx)}</td>}
                    <td className="num" style={{ fontWeight: 700 }}>{inr(net + tx)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div style={{ minWidth: 240 }}>
          {vLines.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="mut">Taxable value</span><b>{inr(v.taxable)}</b>
            </div>
          )}
          {v.is_gst && vLines.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
              <span className="mut">{inter ? "IGST" : "CGST + SGST"}</span><b>{inr(v.tax)}</b>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0",
            borderTop: "2px solid var(--line)", marginTop: 4 }}>
            <span>Grand Total</span><b style={{ fontSize: 16 }}>{inr(v.total)}</b>
          </div>
        </div>
      </div>

      {/* payments received */}
      {isSale && (
        <div className="panel" style={{ marginTop: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ fontSize: 14, margin: 0 }}>Payments received</h3>
            {due <= 0
              ? <span className="chip grn">Fully paid</span>
              : <span className="chip amb">Due {inr(due)}</span>}
          </div>
          <div style={{ paddingTop: 10 }}>
            {receipts.map(r => (
              <div className="led-row" key={r.no}>
                <span><b className="mono">{r.no}</b> · {dmy(r.date)}</span>
                <span className="chip">{r.mode}</span>
                <b>{inr(r.total)}</b>
              </div>
            ))}
            {receipts.length === 0 && (v.paid ?? 0) > 0 && (
              <div className="led-row">
                <span>Paid with invoice</span>
                <span className="chip">{v.mode}</span>
                <b>{inr(v.paid)}</b>
              </div>
            )}
            {receipts.length === 0 && !(v.paid ?? 0) && (
              <p className="mut" style={{ fontSize: 12.5 }}>No payments received yet.</p>
            )}
            <div className="led-row" style={{ borderTop: "2px solid var(--line)", marginTop: 4 }}>
              <span><b>Paid total</b></span><b>{inr(v.paid ?? 0)}</b>
            </div>
            {due > 0 && (
              <div className="led-row">
                <span><b>Balance due</b></span><b className="neg">{inr(due)}</b>
              </div>
            )}
          </div>
        </div>
      )}

      {v.narr && <p className="mut" style={{ fontSize: 12.5, marginTop: 10 }}><i>{v.narr}</i></p>}

      {/* footer */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8,
        marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)", flexWrap: "wrap" }}>
        <Link className="btn" href={`/invoice/${v.id}`} target="_blank">⧉ Open / share page</Link>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={printV}>🖨 Print / PDF</button>
          <button className="btn pri" onClick={onClose}>Close</button>
        </div>
      </div>
    </Shell>
  );

  function printV() {
    const isMoney = vLines.length === 0;

    const lineRows = vLines.map((l: any, i: number) => {
      const net = l._net != null ? Number(l._net)
        : Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;
      const tx = l._tax != null ? Number(l._tax)
        : (v.is_gst ? Math.round(net * (l.gst || 0) / 100 * 100) / 100 : 0);
      return `<tr>
        <td style="padding:4px 6px;border-bottom:1px solid #999">${i + 1}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #999">${esc(l.name)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #999">${esc(l.hsn || "")}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #999;text-align:right">${l.qty}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #999;text-align:right">${Number(l.rate).toFixed(2)}</td>
        <td style="padding:4px 6px;border-bottom:1px solid #999;text-align:right">${net.toFixed(2)}</td>
        ${v.is_gst ? `<td style="padding:4px 6px;border-bottom:1px solid #999;text-align:right">${tx.toFixed(2)}</td>` : ""}
        <td style="padding:4px 6px;border-bottom:1px solid #999;text-align:right">${(net + tx).toFixed(2)}</td>
      </tr>`;
    }).join("");

    const receiptRows = isSale && receipts.length
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:7px">
          <thead><tr><th colspan="4" style="border-top:1.5px solid #000;padding:4px 6px;text-align:left">PAYMENTS RECEIVED</th></tr></thead>
          <tbody>${receipts.map((r: any) =>
            `<tr><td style="padding:4px 6px;border-bottom:1px solid #999">${esc(r.no)}</td>
             <td style="padding:4px 6px;border-bottom:1px solid #999">${esc(dmy(r.date))}</td>
             <td style="padding:4px 6px;border-bottom:1px solid #999">${esc(r.mode)}</td>
             <td style="padding:4px 6px;border-bottom:1px solid #999;text-align:right">${Number(r.total).toFixed(2)}</td></tr>`).join("")}
          </tbody></table>`
      : "";

    const bodyHtml = isMoney
      ? `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:7px">
          <tr><td>Amount</td><td style="text-align:right;font-weight:700;font-size:13px">${Number(v.total).toFixed(2)}</td></tr>
          <tr><td>Mode</td><td style="text-align:right">${esc(v.mode || "")}</td></tr>
          ${v.ref ? `<tr><td>Ref</td><td style="text-align:right">${esc(v.ref)}</td></tr>` : ""}
          ${v.narr ? `<tr><td>Note</td><td style="text-align:right">${esc(v.narr)}</td></tr>` : ""}
        </table>
        <div style="font-style:italic;margin-top:7px">Rupees ${inWords(v.total)} only</div>`
      : `<table style="width:100%;border-collapse:collapse;font-size:11px;margin-top:7px">
          <thead><tr>${["#", "Item", "HSN", "Qty", "Rate", "Taxable",
            ...(v.is_gst ? [inter ? "IGST" : "CGST+SGST"] : []), "Amount"].map(h =>
            `<th style="border-top:1.5px solid #000;border-bottom:1.5px solid #000;padding:4px 6px;text-align:left">${h}</th>`).join("")}</tr></thead>
          <tbody>${lineRows}</tbody>
          <tfoot><tr style="border-top:3px double #000;font-weight:700">
            <td colspan="${v.is_gst ? 7 : 6}" style="padding:4px 6px">Grand Total</td>
            <td style="padding:4px 6px;text-align:right">${Number(v.total).toFixed(2)}</td></tr></tfoot></table>
        <div style="font-style:italic;margin-top:7px">Rupees ${inWords(v.total)} only</div>
        ${receiptRows}
        ${isSale ? `<table style="margin-top:6px;font-size:11px">
          <tr><td>Paid total</td><td style="text-align:right">${Number(v.paid ?? 0).toFixed(2)}</td></tr>
          ${due > 0 ? `<tr><td><b>Balance due</b></td><td style="text-align:right"><b>${due.toFixed(2)}</b></td></tr>` : ""}
        </table>` : ""}`;

    const area = document.getElementById("printArea");
    if (!area) { window.alert("Print area not found on this page."); return; }
    area.innerHTML = `
      <div class="doc" style="font:12px/1.5 sans-serif;width:180mm;margin:0 auto;color:#000">
        <div style="display:flex;justify-content:space-between">
          <div><h2 style="font-size:20px;margin:0">${esc(tenant?.name || "")}</h2>
            <div style="font-size:11px">${esc(tenant?.addr || "")}<br>
              Ph: ${esc(tenant?.phone || "")}${tenant?.gstin ? " · GSTIN: " + esc(tenant.gstin) : ""}</div></div>
          <div style="text-align:right">
            <b style="letter-spacing:.1em">${esc(String(title).toUpperCase())}</b>
            <div class="mono" style="margin-top:3px">${esc(v.no)}</div>
            <div style="font-size:11px">Date: ${esc(v.date)}</div></div></div>
        <div style="border-top:2px solid #000;margin:7px 0"></div>
        <div style="font-size:11px"><b>${partyLabel}:</b>
          ${esc(party?.name || "Cash / Counter")}
          ${party?.gstin ? " · GSTIN " + esc(party.gstin) : ""}
          ${party?.state ? " · " + esc(party.state) : ""}
          ${v.ref ? " · Ref: " + esc(v.ref) : ""}</div>
        ${bodyHtml}
        <div style="text-align:center;font-size:9.5px;margin-top:9px">
          Generated by MunshiCloud · ${esc(tenant?.name || "")}</div>
      </div>`;
    window.print();
  }
}

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 760, maxWidth: "100%", maxHeight: "92vh",
        overflow: "auto", padding: 22 }}>
        {children}
      </div>
    </div>
  );
}