"use client";
import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { savePurchaseAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";
import { SerialInput } from "./SerialInput";

type Item = { id: string; name: string; sku?: string; unit?: string; hsn?: string;
  gst: number; cost: number; has_serial: boolean };
type Sup = { id: string; name: string };
type Line = { item_id: string; name: string; unit: string; hsn: string;
  qty: number; rate: number; gst: number; cost: number; serials?: string[] };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const cell: React.CSSProperties = { padding: "4px 6px" };

function autoRef() {
  const d = new Date();
  const ymd = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return "REF-" + ymd + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function PurchEntry({ items, suppliers }: { items: Item[]; suppliers: Sup[] }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [supId, setSupId] = useState("");
  const [isGst, setIsGst] = useState(false);
  const [ref, setRef] = useState(autoRef());
  const [paid, setPaid] = useState("");          // blank = full credit
  const [payMode, setPayMode] = useState("cash");
  const [searchRow, setSearchRow] = useState<number | null>(null);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [err, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    fd.set("lines", JSON.stringify(lines));
    fd.set("is_gst", isGst ? "1" : "0");
    fd.set("paid", paid);
    fd.set("pay_mode", payMode);
    const r = await savePurchaseAction(fd);
    if (r.error) return r.error;
    router.push("/erp/purchreg?posted=" + encodeURIComponent(r.no!));
    return null;
  }, null);

  const setL = (i: number, patch: Partial<Line>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const pickItem = (i: number, id: string) => {
    const it = items.find(x => x.id === id);
    if (!it) { setL(i, { item_id: "", name: "", unit: "pc", hsn: "", rate: 0, cost: 0 }); return; }
    setL(i, { item_id: it.id, name: it.name, unit: it.unit ?? "pc", hsn: it.hsn ?? "",
      rate: it.cost, gst: it.gst, cost: it.cost, qty: 1,
      serials: it.has_serial ? [] : undefined });
  };

  const addLine = (goSearch = false) => {
    setLines(ls => [...ls,
      { item_id: "", name: "", unit: "pc", hsn: "", qty: 1, rate: 0, gst: 18, cost: 0 }]);
    if (goSearch) {
      setSearchRow(lines.length);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>("#purchLines .ls-input");
        inputs[inputs.length - 1]?.focus();
      }, 40);
    }
  };
  const rmLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));

  /* rates are ALWAYS exclusive of GST:
     GST ON  → GST added on top, total = amount + GST (input credit claimed)
     GST OFF → no tax at all, total = amount (full rate to Stock)          */
  const taxable = lines.reduce((t, l) => t + l.qty * l.rate, 0);
  const tax = isGst ? lines.reduce((t, l) => t + l.qty * l.rate * l.gst / 100, 0) : 0;
  const total = Math.round(isGst ? taxable + tax : taxable);
  const paidN = Math.max(0, Math.min(+paid || 0, total));
  const due = total - paidN;

  const formRefEl = formRef as React.RefObject<HTMLFormElement>;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setSearchRow(lines.length - 1);
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLInputElement>("#purchLines .ls-input");
          inputs[inputs.length - 1]?.focus();
        }, 40);
      }
      if (e.key === "F4") { e.preventDefault(); formRefEl.current?.requestSubmit(); }
      if (e.key === "F8") { e.preventDefault(); addLine(true); }
      if (e.key === "F6") { e.preventDefault(); setIsGst(g => !g); }
      if (e.altKey && e.key === "1") {                       // Alt+1 → full paid, cash
        e.preventDefault(); setPaid(String(total)); setPayMode("cash");
        formRefEl.current?.requestSubmit();
      }
      if (e.altKey && e.key === "2") {                       // Alt+2 → credit
        e.preventDefault(); setPaid("0"); formRefEl.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lines.length, total]);

  const rowEnter = (i: number) => (e: React.KeyboardEvent) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!lines[i].item_id) return;
    if (i === lines.length - 1) addLine(true);
    else {
      setSearchRow(i + 1);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>("#purchLines .ls-input");
        inputs[i + 1]?.focus();
      }, 40);
    }
  };

  return (
    <form ref={formRef} action={submit}>
      {/* ---- mode bar: active segment = BLACK ---- */}
      <div className="tool">
        <div className="seg-toggle" role="tablist">
          <button type="button" className={isGst ? "on" : ""}
            onClick={() => setIsGst(true)}>GST Purchase</button>
          <button type="button" className={!isGst ? "on" : ""}
            onClick={() => setIsGst(false)}>Non-GST Purchase</button>
        </div>
        <span className="chip">All rates excl. GST</span>
        <span style={{ flex: 1 }} />
        <span className="mut" style={{ fontSize: 11 }}>
          <b>F2</b> item · <b>F8</b> line · <b>F6</b> GST · <b>F4</b> save · <b>Alt+1</b> full paid · <b>Alt+2</b> credit</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px",
        gap: 14, alignItems: "start" }}>
        {/* ================= LEFT ================= */}
        <div>
          <div className="panel" style={{ marginBottom: 10 }}>
            <div className="pb"><div className="frm" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8 }}>
              <div><label className="fl">Supplier (blank = cash purchase)</label>
                <LiveSearch items={suppliers} getLabel={s => s.name}
                  placeholder="Cash purchase — type to search…"
                  selectedId={supId || undefined} onPick={s => setSupId(s?.id ?? "")} />
                <input type="hidden" name="party_id" value={supId} /></div>
              <div><label className="fl">Date</label>
                <input className="inp mono" type="date" name="date"
                  defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div><label className="fl">Supplier bill ref</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="inp mono" name="ref" value={ref}
                    onChange={e => setRef(e.target.value)} />
                  <button type="button" className="ib" title="Auto-generate ref"
                    style={{ flex: "none" }}
                    onClick={() => setRef(autoRef())}>⚡</button>
                </div>
                <div className="mut" style={{ fontSize: 10.5, marginTop: 3 }}>
                  auto-generated — overwrite with the supplier's own bill no. if you have it</div></div>
            </div></div>
          </div>

          {/* ---- ONE-ROW-PER-ITEM grid (back-orders allowed) ---- */}
          <div className="panel">
            <div className="entry-tblw">
              <table className="t" style={{ minWidth: 560 }}>
                <thead><tr>
                  <th style={{ ...cell, minWidth: 200 }}>Item</th>
                  <th style={cell}>Qty</th>
                  <th style={cell}>Rate (excl. GST)</th>
                  {isGst && <th style={cell}>GST%</th>}
                  <th className="num" style={cell}>Amount</th>
                  <th style={cell} />
                </tr></thead>
                <tbody id="purchLines">
                  {lines.map((l, i) => {
                    const it = items.find(x => x.id === l.item_id);
                    const tracked = !!it && it.has_serial;
                    const cols = isGst ? 6 : 5;
                    return (
                      <Fragment key={i}>
                        <tr>
                          <td style={{ ...cell, position: "relative", minWidth: 200 }}>
                            {searchRow === i ? (
                              <LiveSearch items={items} getLabel={x => x.name}
                                getSub={x => (x.has_serial ? "S/N · " : "") + "cost " + inr(x.cost) + " excl."}
                                width="100%"
                                placeholder="Type to search item…"
                                selectedId={l.item_id || undefined}
                                onPick={x => { pickItem(i, x?.id ?? ""); setSearchRow(null); }} />
                            ) : (
                              <div onClick={() => setSearchRow(i)}
                                style={{ cursor: "pointer", minHeight: 38,
                                  display: "flex", alignItems: "center", gap: 6 }}>
                                <b>{l.name || <span className="mut">Click / F2 to pick item</span>}</b>
                                {tracked && <span className="chip blu">S/N</span>}
                              </div>
                            )}
                          </td>
                          <td style={cell}>
                            <input className="inp mono" type="number" min="0" style={{ width: 62 }}
                              value={l.qty} onKeyDown={rowEnter(i)} onFocus={() => setSearchRow(null)}
                              onChange={e => {
                                const n = Math.max(0, +e.target.value || 0);
                                setL(i, { qty: n, serials: (l.serials ?? []).slice(0, n) });
                              }} /></td>
                          <td style={cell}>
                            <input className="inp mono" type="number" min="0" step="0.01" style={{ width: 84 }}
                              value={l.rate} onKeyDown={rowEnter(i)} onFocus={() => setSearchRow(null)}
                              onChange={e => setL(i, { rate: Math.max(0, +e.target.value || 0) })} /></td>
                          {isGst && <td style={cell}>
                            <input className="inp mono" type="number" min="0" style={{ width: 54 }}
                              value={l.gst} onKeyDown={rowEnter(i)} onFocus={() => setSearchRow(null)}
                              onChange={e => setL(i, { gst: Math.max(0, +e.target.value || 0) })} /></td>}
                          <td className="num" style={{ ...cell, fontWeight: 700,
                              whiteSpace: "nowrap" }}>{inr(l.qty * l.rate)}</td>
                          <td style={cell}>
                            <button type="button" className="ib" title="Remove"
                              onClick={() => rmLine(i)}>✕</button></td>
                        </tr>
                        {/* serial entry — tracked items only, OPTIONAL (skip = not tracked for this bill) */}
                        {tracked && (
                          <tr>
                            <td colSpan={cols} style={{ ...cell, background: "#fbfaf4" }}>
                              <SerialInput qty={l.qty} value={l.serials ?? []}
                                onChange={v => setL(i, { serials: v })} />
                              <div className="mut" style={{ fontSize: 11, marginTop: 4 }}>
                                Optional — leave empty if you don't track serials for this bill.</div>
                            </td>
                          </tr>)}
                      </Fragment>);
                    })}
                  {!lines.length && (
                    <tr><td colSpan={isGst ? 6 : 5}>
                      <div className="empty" style={{ padding: 22 }}>
                        Press <b>F2</b> or click below to add your first item.</div></td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="pb" style={{ padding: "8px 12px", borderTop: "1px solid var(--line)" }}>
              <button type="button" className="btn sm" onClick={() => addLine(true)}>＋ Add row (F8)</button>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 10 }}>
            <div className="pb">
              <label className="fl">Narration</label>
              <input className="inp" name="narr" placeholder="Transport, damage adjustments…" />
            </div>
          </div>
        </div>

        {/* ================= RIGHT: totals + payment ================= */}
        <div style={{ position: "sticky", top: 70 }}>
          <div className="panel">
            <div className="ph"><h3>Bill Summary</h3>
              <span className={"chip " + (isGst ? "grn" : "")}>{isGst ? "GST" : "Non-GST"}</span></div>
            <div className="pb">
              <div className="led-row"><span>Items</span><b>{lines.filter(l => l.item_id).length}</b></div>
              <div className="led-row"><span>Amount (excl. GST)</span><b>{inr(taxable)}</b></div>
              {isGst && <div className="led-row"><span>GST input credit</span><b>{inr(tax)}</b></div>}
              <div className="led-row" style={{ borderTop: "2px solid var(--line2)", marginTop: 4 }}>
                <span><b>Total payable</b></span>
                <b style={{ font: "700 22px var(--font-disp)" }}>{inr(total)}</b></div>

              {/* ---- payment made block ---- */}
              <div style={{ marginTop: 12, borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
                <label className="fl">Amount paid now</label>
                <input className="inp mono" type="number" min="0" max={total} step="0.01"
                  value={paid} onChange={e => setPaid(e.target.value)}
                  placeholder="0 = credit bill" />
                <div style={{ height: 8 }} />
                <label className="fl">Mode of payment</label>
                <select className="inp" value={payMode} onChange={e => setPayMode(e.target.value)}>
                  {["cash", "upi", "bank", "cheque"].map(m => <option key={m}>{m}</option>)}
                </select>
                <div className="led-row" style={{ marginTop: 8 }}>
                  <span>Balance to pay</span>
                  <b className={due > 0 ? "neg" : "pos"}>{inr(due)}</b></div>
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" className="fchip" onClick={() => setPaid(String(total))}>Full</button>
                  <button type="button" className="fchip" onClick={() => setPaid("0")}>None (credit)</button>
                  <button type="button" className="fchip"
                    onClick={() => setPaid(String(Math.round(total / 2)))}>Half</button>
                </div>
              </div>
            </div>
            <div className="pb" style={{ borderTop: "1px solid var(--line)", display: "flex",
              flexDirection: "column", gap: 8 }}>
              <button className="btn grn" style={{ justifyContent: "center" }}
                disabled={pending || !lines.some(l => l.item_id)}>
                💾 Save Purchase Bill (F4)</button>
              <span className="mut" style={{ fontSize: 11 }}>
                {paidN > 0 ? "Paid " + inr(paidN) + " via " + payMode.toUpperCase()
                  : "Nothing yet — credit bill"}
                {", balance " + inr(due) + " to supplier ledger"}
                {" · "}<b>Alt+1</b> full cash · <b>Alt+2</b> credit</span>
            </div>
          </div>
          {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
        </div>
      </div>
    </form>
  );
}