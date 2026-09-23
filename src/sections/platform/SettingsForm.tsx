"use client";
import { useActionState, useState } from "react";
import { saveTenantSettingsAction } from "./settings";

const BODY_FONTS = ["Karla", "Inter", "Poppins", "Nunito", "Source Sans 3", "Rubik", "Lato", "Work Sans"];
const DISP_FONTS = ["Fraunces", "Playfair Display", "Merriweather", "Lora", "Libre Baskerville"];

export function SettingsForm({ tn, isAdmin }: { tn: Record<string, string | number>; isAdmin: boolean }) {
  const [res, action, pending] = useActionState(async (_: any, fd: FormData) => {
    if (!isAdmin) return { error: "Only the owner can change settings." };
    return await saveTenantSettingsAction(fd);
  }, null);
  const [fb, setFb] = useState(String(tn.font_body));
  const [fd, setFd] = useState(String(tn.font_disp));
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <div className="ph"><h3>Shop settings</h3>
        <span className="mut" style={{ fontSize: 11 }}>profile prints on invoices · fonts style your storefront</span></div>
      <form action={action} className="pb">
        <div className="frm">
          <div><label className="fl">Shop name</label><input className="inp" name="name" defaultValue={String(tn.name)} /></div>
          <div><label className="fl">GSTIN</label><input className="inp mono" name="gstin" defaultValue={String(tn.gstin)} /></div>
          <div className="full"><label className="fl">Address</label><input className="inp" name="addr" defaultValue={String(tn.addr)} /></div>
          <div><label className="fl">Phone</label><input className="inp mono" name="phone" defaultValue={String(tn.phone)} /></div>
          <div><label className="fl">Home state (IGST rule)</label><input className="inp" name="state" defaultValue={String(tn.state)} /></div>
          <div><label className="fl">GST slabs (comma separated)</label><input className="inp mono" name="slabs" defaultValue={String(tn.slabs)} /></div>
          <div><label className="fl">Low-stock level</label><input className="inp mono" name="low" type="number" defaultValue={Number(tn.low)} /></div>
          <div><label className="fl">Heading font (storefront)</label>
            <select className="inp" name="font_disp" value={fd} onChange={e => setFd(e.target.value)}>
              {DISP_FONTS.map(f => <option key={f}>{f}</option>)}</select></div>
          <div><label className="fl">Body font (storefront)</label>
            <select className="inp" name="font_body" value={fb} onChange={e => setFb(e.target.value)}>
              {BODY_FONTS.map(f => <option key={f}>{f}</option>)}</select></div>
        </div>
        {res?.error && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{res.error}</p>}
        <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
          <button className="btn pri" disabled={pending || !isAdmin}>
            {pending ? "Saving…" : "Save settings"}</button>
        </div>
        {!isAdmin && <p className="mut" style={{ fontSize: 11.5, marginTop: 8 }}>Only the owner can change settings.</p>}
      </form>
    </div>
  );
}