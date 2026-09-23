"use client";
import { useActionState } from "react";
import { ownerSetupAction } from "./actions";

export function OwnerSetupForm() {
  const [err, action, pending] = useActionState(ownerSetupAction, null);
  return (
    <div className="authcard"><div className="panel">
      <h2>Platform setup</h2>
      <p className="mut" style={{ fontSize: 12.5, margin: "6px 0 16px" }}>
        One-time, key-protected page to create the platform owner. Closed forever afterwards.</p>
      <form action={action}>
        {err && <p className="neg" style={{ fontSize: 13, marginBottom: 8 }}>{err}</p>}
        <label className="fl">Setup key</label><input className="inp mono" name="key" required />
        <div style={{ height: 10 }} />
        <label className="fl">Your name</label><input className="inp" name="name" required />
        <div style={{ height: 10 }} />
        <label className="fl">Mobile</label><input className="inp mono" name="mobile" maxLength={12} required />
        <div style={{ height: 10 }} />
        <label className="fl">Password (6+)</label><input className="inp" name="password" type="password" required />
        <button className="btn blk" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={pending}>
          {pending ? "Creating…" : "Create platform owner"}</button>
      </form>
    </div></div>);
}