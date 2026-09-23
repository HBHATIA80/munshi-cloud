"use client";
import { useState, useTransition } from "react";
import { reviewUpgradeAction, reviewResetAction } from "./actions";
import { showAlert, showConfirm } from "@/components/Alert";

type T = { id: string; name: string; slug: string; plan: string; status: string;
  created: string; joinCode: string; users: number; invoices: number; gmv: number };
type U = { id: string; name: string; mobile: string; biz: string; note: string;
  status: string; created: string };
type R = { id: string; mobile: string; email: string; status: string;
  hasAccount: boolean; created: string };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export function SuperAdmin({ tenants, upgrades, resets, meId }: {
  tenants: T[]; upgrades: U[]; resets: R[]; meId: string }) {
  const [tab, setTab] = useState<"tenants" | "upgrades" | "resets">("tenants");
  const [pending, start] = useTransition();

  const pUp = upgrades.filter(u => u.status === "pending").length;
  const pRs = resets.filter(r => r.status === "pending").length;

  const togTenant = (id: string, active: boolean) => start(async () => {
    if (await showConfirm(active ? "Suspend business" : "Activate business",
        active
          ? "Its users will be blocked from logging in until re-activated."
          : "Its users regain access immediately.")) {
      await fetch("/sa/toggle", { method: "POST", body: JSON.stringify({ id, active }),
        headers: { "Content-Type": "application/json" } });
      location.reload();
    }
  });

  const setPlan = (id: string, plan: string) => start(async () => {
    await fetch("/sa/plan", { method: "POST", body: JSON.stringify({ id, plan }),
      headers: { "Content-Type": "application/json" } });
    location.reload();
  });

  const review = (id: string, approve: boolean) => start(async () => {
    const r = await reviewUpgradeAction(id, approve);
    if (r.error) showAlert("Failed", r.error, "❌");
    else if (r.shopName) showAlert("Approved 🎉",
      `"${r.shopName}" workspace created — the applicant sees it in their portfolio.`);
    location.reload();
  });

  const doReset = (id: string, approve: boolean, email: string) => start(async () => {
    const r = await reviewResetAction(id, approve);
    if (r.error) showAlert("Failed", r.error, "❌");
    else if (r.temp) {
      showAlert("Password reset 🔑",
        "Temp password: " + r.temp +
        (email ? " — send to " + email : " — share with the user by phone."),
        "🔑");
      if (email) window.open(
        `mailto:${email}?subject=${encodeURIComponent("Your new password")}&body=${encodeURIComponent("Your temporary password is: " + r.temp + "\nPlease log in and change it.")}`);
      location.reload();
    } else location.reload();
  });

  return (
    <>
      <h2 style={{ marginBottom: 14 }}>Platform administration</h2>
      <div className="tool">
        <button className={"fchip" + (tab === "tenants" ? " on" : "")} onClick={() => setTab("tenants")}>
          Businesses ({tenants.length})
        </button>
        <button className={"fchip" + (tab === "upgrades" ? " on" : "")} onClick={() => setTab("upgrades")}>
          Shopkeeper applications {pUp > 0 ? `(${pUp} pending)` : ""}
        </button>
        <button className={"fchip" + (tab === "resets" ? " on" : "")} onClick={() => setTab("resets")}>
          Password requests {pRs > 0 ? `(${pRs} pending)` : ""}
        </button>
      </div>

      {tab === "tenants" && (
        <div className="panel"><div className="tblw"><table className="t">
          <thead><tr><th>Business</th><th>Shop code</th><th>Plan</th>
            <th className="num">Users</th><th className="num">Invoices</th><th className="num">GMV</th>
            <th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {tenants.map(t => (
              <tr key={t.id}>
                <td><b>{t.name}</b>
                  <div className="mut mono" style={{ fontSize: 10.5 }}>/{t.slug} · {t.created}</div></td>
                <td className="mono" style={{ letterSpacing: 1 }}>{t.joinCode}</td>
                <td>
                  <select className="inp mono" style={{ width: 92, fontSize: 12 }}
                    defaultValue={t.plan} disabled={pending}
                    onChange={e => setPlan(t.id, e.target.value)}>
                    {["trial", "basic", "pro"].map(p => <option key={p}>{p}</option>)}
                  </select>
                </td>
                <td className="num">{t.users}</td>
                <td className="num">{t.invoices}</td>
                <td className="num"><b>{inr(t.gmv)}</b></td>
                <td><span className={"chip " + (t.status === "active" ? "grn" : "red")}>{t.status}</span></td>
                <td>
                  <button className="btn sm"
                    disabled={pending}
                    onClick={() => togTenant(t.id, t.status === "active")}>
                    {t.status === "active" ? "Suspend" : "Activate"}
                  </button>
                </td>
              </tr>))}
            {!tenants.length && <tr><td colSpan={8}><div className="empty">No businesses yet.</div></td></tr>}
          </tbody>
        </table></div></div>
      )}

      {tab === "upgrades" && (
        <div className="panel"><div className="tblw"><table className="t">
          <thead><tr><th>Applicant</th><th>Business</th><th>Note</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {upgrades.map(u => (
              <tr key={u.id}>
                <td><b>{u.name || "—"}</b>
                  <div className="mut mono" style={{ fontSize: 10.5 }}>{u.mobile}</div></td>
                <td>{u.biz}</td>
                <td className="mut" style={{ fontSize: 12 }}>{u.note || "—"}</td>
                <td>{u.created}</td>
                <td><span className={"chip " + (u.status === "approved" ? "grn" : u.status === "rejected" ? "red" : "amb")}>{u.status}</span></td>
                <td>
                  {u.status === "pending" && <>
                    <button className="btn sm grn" disabled={pending}
                      onClick={() => review(u.id, true)}>Approve</button>
                    <button className="btn sm dng" disabled={pending}
                      onClick={() => review(u.id, false)}>Reject</button>
                  </>}
                </td>
              </tr>))}
            {!upgrades.length && <tr><td colSpan={6}><div className="empty">No applications yet.</div></td></tr>}
          </tbody>
        </table></div></div>
      )}

      {tab === "resets" && (
        <div className="panel"><div className="tblw"><table className="t">
          <thead><tr><th>Mobile</th><th>Email</th><th>Account</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {resets.map(r => (
              <tr key={r.id}>
                <td className="mono">{r.mobile}</td>
                <td className="mut" style={{ fontSize: 12 }}>{r.email || "—"}</td>
                <td>{r.hasAccount
                  ? <span className="chip grn">found</span>
                  : <span className="chip red">not found</span>}</td>
                <td>{r.created}</td>
                <td><span className={"chip " + (r.status === "done" ? "grn" : r.status === "rejected" ? "red" : "amb")}>{r.status}</span></td>
                <td>
                  {r.status === "pending" && <>
                    <button className="btn sm grn" disabled={pending}
                      onClick={() => doReset(r.id, true, r.email)}>Reset &amp; get temp</button>
                    <button className="btn sm dng" disabled={pending}
                      onClick={() => doReset(r.id, false)}>Reject</button>
                  </>}
                </td>
              </tr>))}
            {!resets.length && <tr><td colSpan={6}><div className="empty">No requests yet.</div></td></tr>}
          </tbody>
        </table></div></div>
      )}
      <span hidden>{meId}</span>
    </>
  );
}