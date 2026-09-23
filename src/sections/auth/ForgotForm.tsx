"use client";
import { useActionState } from "react";
import { submitResetRequestAction } from "@/sections/platform/actions";

export function ForgotForm() {
  const [res, action, pending] = useActionState(async (_: any, fd: FormData) => {
    return await submitResetRequestAction(fd);
  }, null);
  return (
    <div className="authcard"><div className="panel">
      <h2>Reset password</h2>
      {res && !res.error
        ? <p className="pos" style={{ fontSize: 13.5, margin: "12px 0" }}>
            Request received. The platform team will verify and reset your password —
            they'll reach you{""}{/* email hint shown by admin later */} shortly.</p>
        : <form action={action}>
            {res?.error && <p className="neg" style={{ fontSize: 13, marginBottom: 8 }}>{res.error}</p>}
            <label className="fl">Your mobile number</label>
            <input className="inp mono" name="mobile" maxLength={12} required />
            <div style={{ height: 10 }} />
            <label className="fl">Email (optional — for sending the new password)</label>
            <input className="inp" name="email" type="email" />
            <button className="btn pri" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={pending}>
              {pending ? "Sending…" : "Request reset"}</button>
          </form>}
      <p className="mut" style={{ fontSize: 13, marginTop: 14 }}>
        Remembered it? <a className="linkish" href="/login">Log in</a></p>
    </div></div>);
}