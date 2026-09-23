"use client";
import { useActionState } from "react";
import { createBusinessAction } from "./actions";

export function OnboardBizForm({ ownerName, presetName }: { ownerName: string; presetName: string }) {
  const [err, action, pending] = useActionState(createBusinessAction, null);
  return (
    <div className="authcard" style={{ maxWidth: 470 }}>
      <div className="panel">
        <h2>Add a business</h2>
        <p className="mut" style={{ fontSize: 13, margin: "6px 0 16px" }}>
          {ownerName}, create another workspace under your same login — a second shop,
          a new venture. Switch between them from your portfolio.</p>
        <form action={action}>
          {err && <p className="neg" style={{ fontSize: 13, marginBottom: 8 }}>{err}</p>}
          <div className="frm">
            <div className="full"><label className="fl">Business name *</label>
              <input className="inp" name="biz" defaultValue={presetName} required /></div>
            <div><label className="fl">Store slug * (one word)</label>
              <input className="inp mono" name="slug" required /></div>
            <div><label className="fl">State *</label><input className="inp" name="state" required /></div>
            <div><label className="fl">GSTIN</label><input className="inp mono" name="gstin" /></div>
            <div className="full"><label className="fl">Address</label><input className="inp" name="addr" /></div>
            <div><label className="fl">Phone</label><input className="inp mono" name="phone" /></div>
          </div>
          <button className="btn blk" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={pending}>
            {pending ? "Creating…" : "Create workspace"}</button>
        </form>
      </div>
    </div>
  );
}