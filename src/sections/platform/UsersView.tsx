"use client";
import { useState, useTransition } from "react";
import { reclassUserAction, toggleUserAction, createStaffAction } from "@/sections/catalog/actions";
import { resetUserPasswordAction } from "@/sections/platform/actions";
import { inviteMemberAction } from "./invite";
type U = { id: string; name: string; mobile: string | null; role: string; status: string };

export function UsersView({ users, meId, isAdmin }: { users: U[]; meId: string; isAdmin: boolean }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [showStaff, setShowStaff] = useState(false);
  const wrap = (fn: () => Promise<void>) => start(async () => {
    setErr("");
    try { await fn(); } catch (e: any) { setErr(e.message); }
  });
  return (
    <>
      <div className="tool">
        <span className="mut" style={{ fontSize: 13 }}>
          Making someone a <b>Shopkeeper</b> unlocks trade prices + their ledger in the app.
          Staff can post vouchers but can&apos;t manage users or settings.</span>
        <span style={{ flex: 1 }} />
        <button className="btn pri" onClick={() => setShowStaff(true)}>＋ Add staff</button>
      </div>
      <div className="panel"><div className="tblw"><table className="t">
        <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th>Status</th><th /></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td><b>{u.name}</b>{u.id === meId && <span className="chip" style={{ marginLeft: 6 }}>you</span>}</td>
              <td className="mono" style={{ fontSize: 11.5 }}>{u.mobile ?? "—"}</td>
              <td><span className={"chip " + (u.role === "admin" ? "blu" : u.role === "shopkeeper" ? "grn" : "")}>{u.role}</span></td>
              <td><span className={"chip " + (u.status === "active" ? "grn" : "red")}>{u.status}</span></td>
              <td style={{ whiteSpace: "nowrap" }}>
                {(u.role === "retailer" || u.role === "shopkeeper") && (
                  <button className="btn sm" disabled={pending}
                    onClick={() => wrap(() => reclassUserAction(u.id, u.role === "retailer"))}>
                    → {u.role === "retailer" ? "Shopkeeper" : "Retailer"}
                  </button>)}
                {u.id !== meId && (
                  <button className="ib" title={u.status === "active" ? "Suspend" : "Activate"}
                    onClick={() => wrap(() => toggleUserAction(u.id, u.status === "active"))}>
                    {u.status === "active" ? "✕" : "✓"}
                  </button>)}
                {isAdmin && u.id !== meId && (
                  <button className="ib" title="Reset password"
                    onClick={() => {
                      const np = prompt("New password for " + u.name + " (6+ chars):");
                      if (!np) return;
                      start(async () => {
                        setErr("");
                        try {
                          const r = await resetUserPasswordAction(u.id, np);
                          if (r?.error) setErr(r.error);
                          else alert("Password updated — tell " + u.name + ".");
                        } catch (e: any) { setErr(e.message); }
                      });
                    }}>🔑</button>)}
              </td>
            </tr>
          ))}
          {!users.length && <tr><td colSpan={5}><div className="empty">No users found.</div></td></tr>}
        </tbody>
      </table></div></div>
      {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
      {showStaff && <InviteForm onClose={() => setShowStaff(false)} />}
    </>
  );
}

function InviteForm({ onClose }: { onClose: () => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 80, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 460, maxWidth: "100%", padding: 22 }}>
        <h3 style={{ marginBottom: 6 }}>Invite by mobile</h3>
        <p className="mut" style={{ fontSize: 12.5, marginBottom: 14 }}>
          Staff get shop-panel access. Customers get an account with ledger &amp; ordering
          (counts toward your plan cap). If they already use MunshiCloud, they&apos;re linked
          instantly — otherwise a temporary password is created to share with them.</p>
        <form action={fd => start(async () => {
          setErr(""); setOk("");
          const r = await inviteMemberAction(fd);
          if (r.error) setErr(r.error);
          else if (r.temp) { setOk(`Account created — temporary password: ${r.temp} — share it with them now.`); }
          else { setOk("Linked! They'll see this shop in their portfolio."); setTimeout(onClose, 1200); }
        })}>
          <label className="fl">Role</label>
          <select className="inp" name="role" defaultValue="customer">
            <option value="customer">Customer</option>
            <option value="staff">Staff</option>
          </select>
          <div style={{ height: 10 }} />
          <label className="fl">Name *</label><input className="inp" name="name" required />
          <div style={{ height: 10 }} />
          <label className="fl">Mobile *</label>
          <input className="inp mono" name="mobile" maxLength={12} required />
          {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
          {ok && <p className="pos" style={{ fontSize: 13, marginTop: 10, fontWeight: 700 }}>{ok}</p>}
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 16 }}>
            <button type="button" className="btn" onClick={onClose}>Close</button>
            <button className="btn pri" disabled={pending}>{pending ? "Inviting…" : "Send invite"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}