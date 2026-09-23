"use client";
import { useState, useTransition } from "react";
import { cancelMyOrderAction } from "./actions";
import { MyVoucherModal } from "./MyVoucherModal";
import { showAlert, showConfirm } from "@/components/Alert";

type Row = { id: string; no: string; date: string; items: string; total: number;
  pay: string; status: string; invoiceId: string | null; invoiceNo: string | null };
const chip = (s: string) => <span className={"chip " + (s === "delivered" ? "grn" : s === "cancelled" ? "red" : s === "confirmed" ? "blu" : "amb")}>{s}</span>;
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function OrdersClient({ orders }: { orders: Row[] }) {
  const [pending, start] = useTransition();
  const [view, setView] = useState<string | null>(null);

  const cancel = (id: string, no: string) => {
    start(async () => {
      if (await showConfirm("Cancel order", "Cancel " + no + "?")) {
        try { await cancelMyOrderAction(id); location.reload(); }
        catch (e: any) { showAlert("Cancel failed", e.message, "❌"); }
      }
    });
  };

  return (
    <>
      <div className="panel"><div className="tblw"><table className="t">
        <thead><tr><th>Order</th><th>Date</th><th>Items</th><th className="num">Total</th>
          <th>Invoice</th><th>Status</th><th /></tr></thead>
        <tbody>
          {orders.map(o => (
            <tr key={o.id}>
              <td className="mono"><b>{o.no}</b></td><td>{o.date}</td>
              <td style={{ maxWidth: 280 }}>{o.items}</td><td className="num"><b>{inr(o.total)}</b></td>
              <td>{o.invoiceId
                ? <b className="linkish mono" onClick={() => setView(o.invoiceId!)}>{o.invoiceNo ?? "view"}</b>
                : "—"}</td>
              <td>{chip(o.status)}</td>
              <td>{o.status === "placed" &&
                <button className="btn sm" disabled={pending} onClick={() => cancel(o.id, o.no)}>Cancel</button>}</td>
            </tr>))}
          {!orders.length && <tr><td colSpan={7}><div className="empty">No orders yet.</div></td></tr>}
        </tbody>
      </table></div></div>
      {view && <MyVoucherModal id={view} onClose={() => setView(null)} />}
    </>
  );
}