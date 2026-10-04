"use client";
import { useEffect, useRef } from "react";

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");

export function ConfirmBill({ kind, partyLabel, partyName, itemsCount, qtyTotal,
  taxable, gst, inter, total, paidN, due, payMode, shared, saving, onConfirm, onCancel }: {
  kind: "sale" | "purchase";
  partyLabel: string; partyName: string | null;
  itemsCount: number; qtyTotal: number;
  taxable: number; gst: number; inter: boolean;
  total: number; paidN: number; due: number; payMode: string;
  shared?: boolean;
  saving: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onCancel]);

  const cashLabel = kind === "sale" ? "Cash now (received)" : "Cash now (paid)";
  const creditLabel = kind === "sale" ? "Credit — to receive later" : "Credit — payable to supplier";
  const partyLine = partyName ? `${partyLabel}: ${partyName}` : `${kind === "sale" ? "Counter / cash sale" : "Cash purchase"}`;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 96, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="panel" style={{ width: 430, maxWidth: "100%", padding: 20 }}>
        <h3 style={{ margin: "0 0 2px" }}>
          {kind === "sale" ? "Confirm sale" : "Confirm purchase"}</h3>
        <p className="mut" style={{ fontSize: 12, margin: "0 0 12px" }}>{partyLine}</p>

        <div className="led-row"><span>Items</span><b>{itemsCount}</b></div>
        <div className="led-row"><span>Total quantity</span><b>{qtyTotal}</b></div>
        <div className="led-row"><span>Amount (excl. GST)</span><b>{inr(taxable)}</b></div>
        {gst > 0 && (
          <div className="led-row"><span>{inter ? "IGST" : "CGST + SGST"}</span><b>{inr(gst)}</b></div>)}
        <div className="led-row" style={{ borderTop: "2px solid var(--line2)", marginTop: 4 }}>
          <span><b>Grand total</b></span>
          <b style={{ font: "700 22px var(--font-disp)" }}>{inr(total)}</b></div>

        <div className="led-row" style={{ marginTop: 8, borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
          <span>{cashLabel}{paidN > 0 ? ` · ${payMode.toUpperCase()}` : ""}</span>
          <b className="pos">{inr(paidN)}</b></div>
        <div className="led-row">
          <span>{creditLabel}</span>
          <b className="neg">{inr(due)}</b></div>

        {kind === "sale" && shared !== undefined && (
          <div className="led-row">
            <span>Send to shopkeeper portal</span>
            <b>{shared ? "Yes" : "No"}</b></div>)}

        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn" onClick={onCancel}>Cancel (Esc)</button>
          <button type="button" ref={btn} className="btn pri" disabled={saving}
            onClick={onConfirm}>
            {saving ? "Saving…" : `✅ Confirm & save ${kind === "sale" ? "invoice" : "bill"}`}</button>
        </div>
        <p className="mut" style={{ fontSize: 11, marginTop: 8, textAlign: "center" }}>
          Enter = confirm · Esc = cancel</p>
      </div>
    </div>
  );
}