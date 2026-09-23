"use client";
import { useState, useTransition } from "react";
import { setOrderStatusAction, cancelOrderAction, recordOrderPaymentAction } from "@/sections/invoicing/actions";
import { VoucherModal } from "@/sections/invoicing/RegistersView";
import { showAlert, showConfirm } from "@/components/Alert";

type O = { id: string; no: string; date: string; customer: string; mobile: string;
  items: string; total: number; pay: string; status: string;
  invoiceId: string | null; invoiceNo: string; paid: number };
const chip = (s: string) => <span className={"chip " + (s === "delivered" ? "grn" : s === "cancelled" ? "red" : s === "confirmed" ? "blu" : "amb")}>{s}</span>;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function payChip(o: O) {
  const due = o.total - o.paid;
  if (o.total > 0 && due <= 0) return <span className="chip grn">Paid</span>;
  if (o.paid > 0) return <span className="chip amb">Advance {inr(o.paid)}</span>;
  return <span className="chip red">Unpaid</span>;
}

export function OrdersView({ orders, shopName }: { orders: O[]; shopName: string }) {
  const [pending, start] = useTransition();
  const [viewInv, setViewInv] = useState<string | null>(null);
  const [payFor, setPayFor] = useState<O | null>(null);
  const [err, setErr] = useState("");

  const act = (fn: () => Promise<any>) => start(async () => {
    const r = await fn();
    if (r?.error) showAlert("Action failed", r.error, "❌"); else location.reload();
  });

  const askPayment = (o: O) => {
    const due = o.total - o.paid;
    const amt = prompt(`Ask ${o.customer} for payment (order ${o.no}) — amount:`, String(Math.round(due)));
    if (!amt || !(+amt > 0)) return;
    const msg =
      `Namaste ${o.customer}! 🙏\n` +
      `Payment reminder from ${shopName}:\n` +
      `Order ${o.no} — ${inr(+amt)}\n` +
      (o.paid > 0 ? `(Advance ${inr(o.paid)} already received — balance ${inr(due)})\n` : "") +
      `Please share the payment reference or pay on delivery. Thank you!`;
    const mob = o.mobile.replace(/\D/g, "").slice(-10);
    if (mob.length === 10) window.open(`https://wa.me/91${mob}?text=${encodeURIComponent(msg)}`, "_blank");
    else showAlert("No mobile on file", "Call the customer directly.\n\n" + msg, "📞");
  };

  return (
    <>
      <div className="panel"><div className="ph"><h3>Orders from the website</h3>
        <span className="mut" style={{ fontSize: 12 }}>record advances &amp; request payment before delivery</span></div>
        <div className="tblw"><table className="t">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th>
            <th className="num">Total</th><th>Payment</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {orders.map(o => {
              const due = o.total - o.paid;
              return (
              <tr key={o.id}>
                <td className="mono"><b>{o.no}</b></td><td>{o.date}</td>
                <td>{o.customer}<div className="mut mono" style={{ fontSize: 10.5 }}>{o.mobile}</div></td>
                <td style={{ maxWidth: 240 }}>{o.items}</td>
                <td className="num"><b>{inr(o.total)}</b>
                  {o.paid > 0 && <div className="mut" style={{ fontSize: 10.5 }}>recd {inr(o.paid)}</div>}</td>
                <td>{payChip(o)}
                  <div className="mut mono" style={{ fontSize: 10 }}>{o.invoiceNo}</div></td>
                <td>{chip(o.status)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {o.invoiceId && <button className="ib" title="Invoice"
                    onClick={() => setViewInv(o.invoiceId!)}>📄</button>}
                  {o.status !== "cancelled" && due > 0 && <>
                    <button className="btn sm" title="Record advance / payment received"
                      onClick={() => setPayFor(o)}>₹ Received</button>
                    <button className="ib" title="Ask for payment (WhatsApp)"
                      onClick={() => askPayment(o)}>💬</button></>}
                  {o.status === "placed" && <>
                    <button className="btn sm" disabled={pending}
                      onClick={() => act(() => setOrderStatusAction(o.id, "confirmed"))}>Confirm</button>
                    <button className="ib" title="Cancel & restock" disabled={pending}
                      onClick={() => start(async () => {
                        if (await showConfirm("Cancel " + o.no, "Items return to stock and the invoice is removed.")) {
                          const r = await cancelOrderAction(o.id);
                          if (r.error) showAlert("Cancel failed", r.error, "❌"); else location.reload();
                        }
                      })}>🗑</button></>}
                  {o.status === "confirmed" && (
                    <button className="btn sm" disabled={pending}
                      onClick={() => act(() => setOrderStatusAction(o.id, "delivered"))}>Delivered</button>)}
                </td>
              </tr>);
            })}
            {!orders.length && <tr><td colSpan={8}><div className="empty">No website orders yet.</div></td></tr>}
          </tbody>
        </table></div></div>

      {payFor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setPayFor(null); }}>
          <div className="panel" style={{ width: 420, maxWidth: "100%", padding: 20 }}>
            <h3 style={{ marginBottom: 6 }}>Record payment — {payFor.no}</h3>
            <p className="mut" style={{ fontSize: 12.5, marginBottom: 12 }}>
              {payFor.customer} · due {inr(payFor.total - payFor.paid)} of {inr(payFor.total)}.
              Use this when the customer pays an advance by cash/UPI directly to you.</p>
            <form action={fd => start(async () => {
              setErr("");
              const r = await recordOrderPaymentAction(
                payFor.id, +String(fd.get("amt") || 0), String(fd.get("mode") || "cash"));
              if (r.error) setErr(r.error); else { setPayFor(null); location.reload(); }
            })}>
              <label className="fl">Amount received</label>
              <input className="inp mono" name="amt" type="number" min="1" step="0.01"
                defaultValue={Math.round(payFor.total - payFor.paid)} required />
              <div style={{ height: 10 }} />
              <label className="fl">Mode</label>
              <select className="inp" name="mode">
                <option value="cash">Cash</option><option value="upi">UPI</option>
                <option value="bank">Bank transfer</option><option value="cheque">Cheque</option>
              </select>
              {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
                <button type="button" className="btn" onClick={() => setPayFor(null)}>Cancel</button>
                <button className="btn pri" disabled={pending}>Record</button>
              </div>
            </form>
          </div>
        </div>)}

      {viewInv && <VoucherModal id={viewInv} onClose={() => setViewInv(null)} />}
    </>
  );
}