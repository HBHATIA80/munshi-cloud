import { requireCustomer } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmt0 } from "@/lib/format";
import { ordChip } from "@/sections/account/ui";
import { PasswordCard } from "@/sections/platform/PasswordCard";

export default async function AccountHome() {
  const s = await requireCustomer();
  const sb = await createClient();
  const isShop = s.partyType === "shopkeeper";
  const [{ data: orders }, { data: pRow }] = await Promise.all([
    sb.from("orders").select("*").eq("user_id", s.userId).order("created_at", { ascending: false }),
    sb.from("parties").select("id,open").eq("user_id", s.userId).limit(1),
  ]);
  const partyId = pRow?.[0]?.id ?? null;
  let dues = 0, invCount = 0;
  if (isShop && partyId) {
    const { data: vs } = await sb.from("vouchers").select("type,total,paid").eq("party_id", partyId);
    invCount = (vs ?? []).filter(v => v.type === "sale").length;
    dues = (vs ?? []).filter(v => v.type === "sale").reduce((t, v) => t + v.total - v.paid, 0);
  }
  const recent = (orders ?? []).slice(0, 5);
  return (
    <>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <div className="kpi"><div className="l">Orders</div><div className="v">{orders?.length ?? 0}</div>
          <div className="s">{(orders ?? []).filter(o => o.status === "delivered").length} delivered</div></div>
        {isShop && <>
          <div className="kpi"><div className="l">Current dues</div>
            <div className="v" style={{ color: dues > 0 ? "var(--red)" : "inherit" }}>{fmt0(Math.max(dues, 0))}</div>
            <div className="s">payable to the shop</div></div>
          <div className="kpi"><div className="l">Invoices</div><div className="v">{invCount}</div>
            <div className="s">+ credit notes</div></div>
        </>}
      </div>
      <div className="panel"><div className="ph"><h3>Recent orders</h3>
        <a className="btn sm" href="/account/orders">All orders</a></div>
        <div className="tblw"><table className="t">
          <thead><tr><th>Order</th><th>Date</th><th className="num">Total</th><th>Payment</th><th>Status</th></tr></thead>
          <tbody>
            {recent.map(o => (
              <tr key={o.id}><td className="mono"><b>{o.no}</b></td><td>{o.date}</td>
                <td className="num">{fmt0(+o.total)}</td><td>{o.pay === "cod" ? "COD" : "On account"}</td>
                <td>{ordChip(o.status)}</td></tr>))}
            {!recent.length && <tr><td colSpan={5}><div className="empty">
              No orders yet — <a className="linkish" href="/">start shopping</a></div></td></tr>}
          </tbody>
        </table></div></div>
      <PasswordCard />
    </>
  );
}