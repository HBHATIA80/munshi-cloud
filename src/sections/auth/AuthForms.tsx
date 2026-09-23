"use client";
import { useActionState } from "react";
import { loginAction, signupCustomerAction, signupBizAction } from "./actions";

function Err({ msg }: { msg: string | null }) {
  return msg ? <p className="neg" style={{ fontSize: 13, marginBottom: 8 }}>{msg}</p> : null;
}

export function LoginForm() {
  const [err, action, pending] = useActionState(loginAction, null);
  return (
    <div className="authcard"><div className="panel">
      <h2>Welcome back</h2>
      <p className="mut" style={{ fontSize: 13, marginBottom: 16 }}>
        Customers, staff and the owner all log in here — your mobile number is your ID.</p>
      <form action={action}>
        <Err msg={err} />
        <label className="fl">Mobile number</label>
        <input className="inp mono" name="mobile" maxLength={12} placeholder="10-digit mobile" />
        <div style={{ height: 10 }} />
        <label className="fl">Password</label>
        <input className="inp" name="password" type="password" />
        <button className="btn pri" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={pending}>
          {pending ? "Checking…" : "Log in"}
        </button>
      </form>
      <p className="mut" style={{ fontSize: 13, marginTop: 14 }}>
        New here? <a className="linkish" href="/signup">Create a customer account</a></p>
    <p className="mut" style={{ fontSize: 12.5, marginTop: 8 }}>
  <a className="linkish" href="/forgot">Forgot password?</a></p>
    </div></div>
  );
}

export function SignupForm() {
  const [err, action, pending] = useActionState(signupCustomerAction, null);
  return (
    <div className="authcard"><div className="panel">
      <h2>Create your account</h2>
      <p className="mut" style={{ fontSize: 13, marginBottom: 16 }}>
        Orders, invoices and (for shopkeepers) your running ledger — everything ties to this number.</p>
      <form action={action}>
        <Err msg={err} />
        <label className="fl">Your name / shop name</label><input className="inp" name="name" />
        <div style={{ height: 10 }} />
        <label className="fl">Mobile number</label><input className="inp mono" name="mobile" maxLength={12} />
        <div style={{ height: 10 }} />
        <label className="fl">Password (6+ chars)</label><input className="inp" name="password" type="password" />
        <button className="btn pri" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </button>
      </form>
      <p className="mut" style={{ fontSize: 13, marginTop: 14 }}>
        Own a business? <a className="linkish" href="/login">Log in instead</a></p>
    </div></div>
  );
}

export function BizSignupForm() {
  const [err, action, pending] = useActionState(signupBizAction, null);
  return (
    <div className="authcard" style={{ maxWidth: 470 }}><div className="panel">
      <h2>Register your business</h2>
      <p className="mut" style={{ fontSize: 13, marginBottom: 16 }}>
        Creates an isolated workspace — your items, parties, invoices, staff — with you as owner.
        This page is deliberately not linked from the public site.</p>
      <form action={action}>
        <Err msg={err} />
        <div className="frm">
          <div className="full"><label className="fl">Business name *</label><input className="inp" name="biz" /></div>
          <div><label className="fl">Store slug * (one word)</label><input className="inp mono" name="slug" defaultValue="main" /></div>
          <div><label className="fl">State *</label><input className="inp" name="state" /></div>
          <div><label className="fl">GSTIN</label><input className="inp mono" name="gstin" /></div>
          <div className="full"><label className="fl">Shop address</label><input className="inp" name="addr" /></div>
          <div><label className="fl">Phone</label><input className="inp mono" name="phone" /></div>
          <div><label className="fl">Your name *</label><input className="inp" name="name" /></div>
          <div><label className="fl">Mobile *</label><input className="inp mono" name="mobile" maxLength={12} /></div>
          <div className="full"><label className="fl">Password * (6+ chars)</label><input className="inp" name="password" type="password" /></div>
        </div>
        <button className="btn blk" style={{ width: "100%", justifyContent: "center", marginTop: 16 }} disabled={pending}>
          {pending ? "Creating…" : "Create workspace"}
        </button>
      </form>
    </div></div>
  );
}