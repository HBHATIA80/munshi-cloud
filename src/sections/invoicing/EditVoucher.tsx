"use client";
import { useEffect, useState, useTransition } from "react";
import { updateSaleAction, updatePurchaseAction, fetchVoucherByIdAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";
import { showAlert } from "@/components/Alert";

type Item = { hsn: string; id: string; name: string; sku: string; unit: string; gst: number;
  cost: number; pr: number; ps: number; stock: number };
type Party = { id: string; name: string; type: string; state: string | null };
type Line = { item_id: string; name: string; unit: string; hsn: string;
  qty: number; rate: number; disc: number; gst: number; cost: number };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const cell: React.CSSProperties = { padding: "4px 6px" };

export function EditVoucher({ voucherId, kind, onClose, onSaved }: {
  voucherId: string; kind: "sale" | "purchase";
  onClose: () => void; onSaved: (no: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const [v, setV] = useState<any>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [partyId, setPartyId] = useState("");
  const [isGst, setIsGst] = useState(true);
  const [billDisc, setBillDisc] = useState(0);
  const [paid, setPaid] = useState("0");
  const [ref, setRef] = useState("");
  const [narr, setNarr] = useState("");
  const [date, setDate] = useState("");
  const [err, setErr] = useState("");
  const [saving, start] = useTransition();

  useEffect(() => {
    let live = true;
    (async () => {
      const fd = new FormData(); fd.set("id", voucherId);
      const r = await fetchVoucherByIdAction(fd);
      if (!live) return;
      if (!r) { setErr("Voucher not found"); setLoaded(true); return; }
      const vv = r.v as any;
      setV(vv);
      setItems(r.items as Item[]);
      setParties(r.parties as Party[]);
      setLines((vv.lines ?? []).map((l: any) => ({
        item_id: l.item_id, name: l.name, unit: l.unit ?? "pc", hsn: l.hsn ?? "",
        qty: +l.qty, rate: +l.rate, disc: +(l.disc ?? 0), gst: +l.gst, cost: +(l.cost ?? 0),
      })));
      setPartyId(vv.party_id ?? "");
      setIsGst(!!vv.is_gst);
      setBillDisc(Number(vv.bill_disc) || 0);
      setPaid(String(+(vv.paid ?? 0) || 0));
      setRef(vv.ref ?? "");
      setNarr(vv.narr ?? "");
      setDate(vv.date ?? "");
      setLoaded(true);
    })();
    return () => { live = false; };
  }, [voucherId]);

  const setL = (i: number, patch: Partial<Line>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pickItem = (i: number, id: string) => {
    const it = items.find(x => x.id === id);
    if (!it) { setL(i, { item_id: "", name: "", unit: "pc", hsn: "", rate: 0, cost: 0 }); return; }
    setL(i, { item_id: it.id, name: it.name, unit: it.unit, hsn: it.hsn ?? "",
      rate: kind === "sale"
        ? (partyId && parties.find(p => p.id === partyId)?.type === "shopkeeper" ? it.ps : it.pr)
        : it.cost,
      cost: it.cost, gst: it.gst, qty: Math.max(0, lines[i].qty) });
  };
  const addLine = () => setLines(ls => [...ls,
    { item_id: "", name: "", unit: "pc", hsn: "", qty: 1, rate: 0, disc: 0, gst: 18, cost: 0 }]);
  const rmLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));

  const net = (l: Line) => l.qty * l.rate * (1 - l.disc / 100);
  const taxable = lines.reduce((t, l) => t + net(l), 0);
  const bd = Number.isFinite(billDisc) ? Math.min(billDisc, taxable) : 0;
  const netT = taxable - bd;
  const tax = isGst ? netT * (taxable ? lines.reduce((t, l) => t + net(l) * l.gst / 100, 0) / taxable : 0) : 0;
  const total = Math.round(netT + tax);
  const paidN = Math.max(0, Math.min(+paid || 0, total));
  const due = total - paidN;

  const save = () => start(async () => {
    setErr("");
    const fd = new FormData();
    fd.set("id", voucherId);
    fd.set("lines", JSON.stringify(lines));
    fd.set("party_id", partyId);
    fd.set("is_gst", isGst ? "1" : "0");
    fd.set("bill_disc", String(bd));
    fd.set("paid", String(paidN));
    fd.set("date", date);
    fd.set("ref", ref);
    fd.set("narr", narr);
    const r = kind === "sale" ? await updateSaleAction(fd) : await updatePurchaseAction(fd);
    if (r.error) { setErr(r.error); showAlert("Save failed", r.error, "❌"); }
    else { showAlert("Saved ✅", r.no! + " updated — stock & ledgers re-applied."); onSaved(r.no!); }
  });

  if (!loaded) return <Shell onClose={onClose}><div className="empty">Loading…</div></Shell>;
  if (err && !v) return <Shell onClose={onClose}><p className="neg">{err}</p></Shell>;

  return (
    <Shell onClose={onClose}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
        <h3 style={{ fontSize: 17 }}>Edit {kind === "sale" ? "Invoice" : "Purchase Bill"} — <span className="mono">{v?.no}</span></h3>
        <span className="chip amb">editing reverses &amp; re-applies stock</span>
      </div>

      <div className="frm" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 12 }}>
        {kind === "sale" ? (
          <div><label className="fl">Party (blank = counter sale)</label>
            <LiveSearch items={parties} getLabel={p => p.name}
              getSub={p => p.type} placeholder="Counter / Cash Sale…"
              selectedId={partyId || undefined}
              onPick={p => { setPartyId(p?.id ?? "");
                const np = parties.find(x => x.id === (p?.id ?? ""));
                setLines(ls => ls.map(l => {
                  const it = items.find(x => x.id === l.item_id);
                  return it ? { ...l, rate: np?.type === "shopkeeper" ? it.ps : it.pr } : l;
                }));
              }} /></div>
        ) : (
          <div><label className="fl">Supplier (blank = cash purchase)</label>
            <LiveSearch items={parties.filter(p => p.type === "supplier")} getLabel={p => p.name}
              placeholder="Cash purchase…" selectedId={partyId || undefined}
              onPick={p => setPartyId(p?.id ?? "")} /></div>
        )}
        <div><label className="fl">Date</label>
          <input className="inp mono" type="date" value={date}
            onChange={e => setDate(e.target.value)} /></div>
        <div><label className="fl">Bill ref</label>
          <input className="inp mono" value={ref} onChange={e => setRef(e.target.value)} /></div>
        <div><label className="fl">Tax</label>
          <div className="seg-toggle">
            <button type="button" className={isGst ? "on" : ""}
              onClick={() => setIsGst(true)}>GST</button>
            <button type="button" className={!isGst ? "on" : ""}
              onClick={() => setIsGst(false)}>Non-GST</button>
          </div></div>
      </div>

      <div className="entry-tblw">
        <table className="t" style={{ minWidth: 520 }}>
          <thead><tr>
            <th style={{ ...cell, minWidth: 190 }}>Item</th>
            <th style={cell}>Qty</th><th style={cell}>Rate</th>
            {isGst && kind === "sale" && <th style={cell}>GST%</th>}
            {kind === "sale" && <th style={cell}>Disc%</th>}
            <th className="num" style={cell}>Amount</th><th style={cell} />
          </tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td style={{ ...cell, position: "relative", minWidth: 190 }}>
                  <LiveSearch items={items} getLabel={x => x.name}
                    getSub={x => x.stock + " left"} width="100%"
                    placeholder="Search…" selectedId={l.item_id || undefined}
                    onPick={x => pickItem(i, x?.id ?? "")} />
                </td>
                <td style={cell}>
                  <input className="inp mono" type="number" min="0" style={{ width: 60 }}
                    value={l.qty} onChange={e => setL(i, { qty: Math.max(0, +e.target.value || 0) })} /></td>
                <td style={cell}>
                  <input className="inp mono" type="number" min="0" step="0.01" style={{ width: 80 }}
                    value={l.rate} onChange={e => setL(i, { rate: Math.max(0, +e.target.value || 0) })} /></td>
                {isGst && kind === "sale" && <td style={cell}>
                  <input className="inp mono" type="number" min="0" style={{ width: 52 }}
                    value={l.gst} onChange={e => setL(i, { gst: Math.max(0, +e.target.value || 0) })} /></td>}
                {kind === "sale" && <td style={cell}>
                  <input className="inp mono" type="number" min="0" style={{ width: 52 }}
                    value={l.disc} onChange={e => setL(i, { disc: Math.max(0, +e.target.value || 0) })} /></td>}
                <td className="num" style={{ ...cell, fontWeight: 700 }}>{inr(net(l))}</td>
                <td style={cell}>
                  <button type="button" className="ib" onClick={() => rmLine(i)}>✕</button></td>
              </tr>))}
          </tbody>
        </table>
      </div>
      <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={addLine}>
        ＋ Add row</button>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <div className="tot-blk">
          <div className="tr"><span>Taxable</span><b>{inr(taxable)}</b></div>
          {isGst && <div className="tr"><span>GST</span><b>{inr(tax)}</b></div>}
          <div className="tr gr"><span>Total</span><b>{inr(total)}</b></div>
          <div className="tr"><span>Paid / Received</span>
            <input className="inp mono" type="number" min="0" max={total} step="0.01"
              style={{ width: 90, padding: "3px 6px", fontSize: 12 }}
              value={paid} onChange={e => setPaid(e.target.value)} /></div>
          <div className="tr"><span>Balance due</span>
            <b className={due > 0 ? "neg" : "pos"}>{inr(due)}</b></div>
        </div>
      </div>

      <div className="pb" style={{ padding: "10px 0 0" }}>
        <label className="fl">Narration</label>
        <input className="inp" value={narr} onChange={e => setNarr(e.target.value)} />
      </div>

      {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn pri" disabled={saving} onClick={save}>
          {saving ? "Saving…" : "Save changes"}</button>
      </div>
    </Shell>
  );
}

function Shell({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 85, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 760, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", padding: 22 }}>
        {children}
      </div>
    </div>
  );
}