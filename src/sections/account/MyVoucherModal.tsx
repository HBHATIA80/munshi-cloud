"use client";
import { useEffect, useState } from "react";
import { getMyVoucherAction } from "@/sections/invoicing/actions";

export function MyVoucherModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [d, setD] = useState<{ v: any; party: any; tenant: any } | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let live = true;
    getMyVoucherAction(id).then(r => {
      if (!live) return;
      if (r) setD(r); else setErr("Invoice not found.");
    });
    return () => { live = false; };
  }, [id]);
  if (err) return <Shell onClose={onClose}><p className="neg">{err}</p></Shell>;
  if (!d) return <Shell onClose={onClose}><div className="empty">Loading…</div></Shell>;
  const { v, party, tenant } = d;
  const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
  return (
    <Shell onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div>
          <b style={{ font: "600 17px var(--font-disp)" }}>{tenant?.name}</b>
          <div className="mut" style={{ fontSize: 11.5 }}>{tenant?.addr} · GSTIN {tenant?.gstin}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <span className={"chip " + (v.type === "sale" ? "grn" : "amb")}>{v.type === "sale" ? "invoice" : "credit note"}</span>
          <div className="mono" style={{ fontWeight: 700, marginTop: 4 }}>{v.no}</div>
          <div className="mut" style={{ fontSize: 12 }}>{v.date} · {party?.name ?? ""}</div>
        </div>
      </div>
      {(v.lines ?? []).length > 0 && (
        <div className="tblw"><table className="t">
          <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Rate</th>
            <th className="num">Taxable</th>{v.is_gst ? <th className="num">GST</th> : null}
            <th className="num">Amount</th></tr></thead>
          <tbody>
            {(v.lines as any[]).map((l, i) => {
              const net = l._net != null ? Number(l._net) : l.qty * l.rate;
              const tax = l._tax != null ? Number(l._tax) : (v.is_gst ? net * l.gst / 100 : 0);
              return (
                <tr key={i}>
                  <td><b>{l.name}</b></td>
                  <td className="num">{l.qty}</td>
                  <td className="num">{inr(l.rate)}</td>
                  <td className="num">{inr(net)}</td>
                  {v.is_gst ? <td className="num">{inr(tax)}</td> : null}
                  <td className="num">{inr(net + tax)}</td>
                </tr>);
            })}
          </tbody>
        </table></div>)}
      <div className="tot-blk" style={{ marginTop: 12 }}>
        {v.is_gst && <div className="tr"><span>Taxable</span><b>{inr(v.taxable)}</b></div>}
        {v.is_gst && <div className="tr"><span>GST</span><b>{inr(v.tax)}</b></div>}
        <div className="tr gr"><span>Total</span><b>{inr(v.total)}</b></div>
        <div className="tr"><span>Paid ({v.mode})</span><b>{inr(v.paid)}</b></div>
        {v.type === "sale" && v.total - v.paid > 0 &&
          <div className="tr"><span className="neg">Balance due</span><b className="neg">{inr(v.total - v.paid)}</b></div>}
      </div>
      <div style={{ clear: "both" }} />
      {v.narr && <p className="mut" style={{ fontSize: 12.5, marginTop: 10 }}><i>{v.narr}</i></p>}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
        <button className="btn pri" onClick={onClose}>Close</button>
      </div>
    </Shell>
  );
}

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 680, maxWidth: "100%", maxHeight: "90vh", overflow: "auto", padding: 20 }}>
        {children}
      </div>
    </div>
  );
}