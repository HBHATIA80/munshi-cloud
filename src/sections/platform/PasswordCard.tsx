"use client";
import { useActionState } from "react";
import { changeMyPasswordAction } from "./actions";

export function PasswordCard() {
  const [res, submit, pending] = useActionState(async (_: any, fd: FormData) => {
    return await changeMyPasswordAction(fd);
  }, null);
  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <div className="ph"><h3>Change my password</h3></div>
      <form action={submit} className="pb">
        <label className="fl">New password (6+ chars)</label>
        <input className="inp" name="np" type="password" required minLength={6} style={{ maxWidth: 300 }} />
        {res?.error && <p className="neg" style={{ fontSize: 13, marginTop: 8 }}>{res.error}</p>}
        <div><button className="btn pri" style={{ marginTop: 12 }} disabled={pending}>
          {pending ? "Saving…" : "Update password"}</button></div>
      </form>
    </div>
  );
}