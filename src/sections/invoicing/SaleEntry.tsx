"use client";
import { Fragment, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSaleAction, serialsForItemAction, purchaseHistoryAction } from "./actions";
import { LiveSearch } from "@/components/LiveSearch";
import { SerialInput } from "./SerialInput";
import { LastPurchaseChip, PriceCompare } from "./PriceIntel";

type Item = { hsn: string; id: string; name: string; sku: string; unit: string; gst: number;
  cost: number; pr: number; ps: number; stock: number; has_serial: boolean };
type Party = { id: string; name: string; type: string; state: string | null };
type Line = { item_id: string; name: string; unit: string; hsn: string;
  qty: number; rate: number; disc: number; gst: number; cost: number; serials?: string[] };
type PU = { no: string; date: string; qty: number; rate: number; supplier: string };

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
const cell: React.CSSProperties = { padding: "4px 6px" };

function autoRef() {
  const d = new Date();
  const ymd = d.getFullYear().toString() +
    String(d.getMonth() + 1).padStart(2, "0") +
    String(d.getDate()).padStart(2, "0");
  return "REF-" + ymd + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

export function SaleEntry({ items, parties, homeState }: {
  items: Item[]; parties: Party[]; homeState: string }) {
  const [lines, setLines] = useState<Line[]>([]);
  const [partyId, setPartyId] = useState("");
  const [isGst, setIsGst] = useState(false);
  const [billDisc, setBillDisc] = useState(0);
  const [ref, setRef] = useState(autoRef());
  const [paid, setPaid] = useState("");        // blank = credit (nothing received)
  const [payMode, setPayMode] = useState("cash");
  const [searchRow, setSearchRow] = useState<number | null>(null);
  // in-stock serials per item id — fetched once when a serial-tracked item is picked
  const [serialStock, setSerialStock] = useState<Record<string, string[]>>({});
  // last-5 purchase history per item id — fetched on pick / when opening the compare panel
  const [hist, setHist] = useState<Record<string, PU[]>>({});
  const [compare, setCompare] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [err, submit, pending] = useActionState(async (_: string | null, fd: FormData) => {
    fd.set("lines", JSON.stringify(lines));
    const r = await saveSaleAction(fd);
    if (r.error) return r.error;
    router.push("/erp/sales?posted=" + encodeURIComponent(r.no!));
    return null;
  }, null);

  const party = parties.find(p => p.id === partyId);
  const inter = !!(party?.state && homeState && party.state !== homeState);
  const priceOf = (it: Item) => (party?.type === "shopkeeper" ? it.ps : it.pr);

  const setL = (i: number, patch: Partial<Line>) =>
    setLines(ls => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  // fetch last-5 purchase history for any items not yet loaded
  const loadHist = (ids: string[]) => {
    const need = ids.filter(id => id && !hist[id]);
    if (need.length)
      purchaseHistoryAction(need).then(h => setHist(m => ({ ...m, ...h })));
  };

  // add (fetch) or remove (from comparison) an item in the compare panel
  const toggleCompare = (id: string) => {
    if (hist[id]) {
      setHist(m => { const n = { ...m }; delete n[id]; return n; });
    } else {
      loadHist([id]);
    }
  };

  const pickItem = (i: number, id: string) => {
    const it = items.find(x => x.id === id);
    if (!it) { setL(i, { item_id: "", name: "", unit: "pc", hsn: "", rate: 0, cost: 0 }); return; }
    setL(i, { item_id: it.id, name: it.name, unit: it.unit, hsn: it.hsn ?? "", gst: it.gst,
      rate: priceOf(it), cost: it.cost, qty: 1, disc: 0, serials: it.has_serial ? [] : undefined });
    // fetch in-stock serials once per tracked item (picker mode)
    if (it.has_serial && !serialStock[it.id]) {
      serialsForItemAction(it.id).then(list =>
        setSerialStock(m => ({ ...m, [it.id]: (list as any[]).map((r: any) => r.serial) })));
    }
    // fetch purchase history for the price chip
    loadHist([it.id]);
  };

  const pickParty = (id: string) => {
    setPartyId(id);
    const np = parties.find(p => p.id === id);
    const p2 = (it: Item) => (np?.type === "shopkeeper" ? it.ps : it.pr);
    setLines(ls => ls.map(l => {
      const it = items.find(x => x.id === l.item_id);
      return it ? { ...l, rate: p2(it) } : l;
    }));
  };

  const addLine = (goSearch = false) => {
    setLines(ls => [...ls,
      { item_id: "", name: "", unit: "pc", hsn: "", qty: 1, rate: 0, disc: 0, gst: 18, cost: 0 }]);
    if (goSearch) {
      setSearchRow(lines.length);
      setTimeout(() => {
        const inputs = document.querySelectorAll<HTMLInputElement>("#saleLines .ls-input");
        inputs[inputs.length - 1]?.focus();
      }, 40);
    }
  };
  const rmLine = (i: number) => setLines(ls => ls.filter((_, j) => j !== i));

  const net = (l: Line) => l.qty * l.rate * (1 - l.disc / 100);
  const taxable = lines.reduce((t, l) => t + net(l), 0);
  const bd = Math.min(billDisc, taxable);
  const netT = taxable - bd;
  const taxRatio = taxable ? lines.reduce((t, l) => t + net(l) * l.gst / 100, 0) / taxable : 0;
  const tax = isGst ? netT * taxRatio : 0;
  const total = Math.round(netT + tax);
  const paidN = Math.max(0, Math.min(+paid || 0, total));
  const due = total - paidN;

  // serial guard: tracked item with in-stock serials must have exactly qty selected
  const serialsIncomplete = lines.some(l => {
    const it = items.find(x => x.id === l.item_id);
    return !!it && it.has_serial && (serialStock[l.item_id]?.length ?? 0) > 0
      && (l.serials?.length ?? 0) !== l.qty;
  });

  const formRefEl = formRef as React.RefObject<HTMLFormElement>;
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        setSearchRow(lines.length - 1);
        setTimeout(() => {
          const inputs = document.querySelectorAll<HTMLInputElement>("#saleLines .ls-input");
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
        const inputs = document.querySelectorAll<HTMLInputElement>("#saleLines .ls-input");
        inputs[i + 1]?.focus();
      }, 40);
    }
  };

  return (
    <form ref={formRef} action={submit}>
      <div className="tool">
        <div className="seg-toggle" role="tablist">
          <button type="button" className={isGst ? "on" : ""}
            onClick={() => setIsGst(true)}>GST Invoice</button>
          <button type="button" className={!isGst ? "on" : ""}
            onClick={() => setIsGst(false)}>Non-GST Bill</button>
        </div>
        <span className="chip">All rates excl. GST</span>
        <span style={{ flex: 1 }} />
        {isGst && (inter
          ? <span className="chip amb">Inter-state → IGST</span>
          : <span className="chip grn">Intra-state → CGST + SGST</span>)}
        <span className="mut kbd-hints" style={{ fontSize: 11 }}>
          <b>F2</b> item · <b>F8</b> line · <b>F6</b> GST · <b>F4</b> save · <b>Alt+1</b> full paid · <b>Alt+2</b> credit</span>
      </div>

      <div className="entry-grid">
        {/* ================= LEFT ================= */}
        <div>
          <div className="panel" style={{ marginBottom: 10 }}>
            <div className="pb"><div className="frm" style={{ gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8 }}>
              <div><label className="fl">Party (blank = counter sale)</label>
                <LiveSearch items={parties} getLabel={p => p.name}
                  getSub={p => p.type + (p.state ? " · " + p.state : "")}
                  placeholder="Counter / Cash Sale — type to search…"
                  selectedId={partyId || undefined} onPick={p => pickParty(p?.id ?? "")} />
                <input type="hidden" name="party_id" value={partyId} /></div>
              <div><label className="fl">Date</label>
                <input className="inp mono" type="date" name="date"
                  defaultValue={new Date().toISOString().slice(0, 10)} /></div>
              <div><label className="fl">Bill disc ₹</label>
                <input className="inp mono" type="number" min="0"
                  value={billDisc || ""} onChange={e => setBillDisc(+e.target.value || 0)} />
                <input type="hidden" name="bill_disc" value={billDisc} /></div>
              <div><label className="fl">Bill reference</label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input className="inp mono" name="ref" value={ref}
                    onChange={e => setRef(e.target.value)} placeholder="Auto-generated" />
                  <button type="button" className="ib" title="Auto-generate ref"
                    style={{ flex: "none" }}
                    onClick={() => setRef(autoRef())}>⚡</button>
                </div></div>
            </div></div>
          </div>

          <div className="panel">
            <div className="entry-tblw">
              <table className="t" style={{ minWidth: 560 }}>
                <thead><tr>
                  <th style={{ ...cell, minWidth: 200 }}>Item</th>
                  <th style={cell}>Qty</th>
                  <th style={cell}>Rate (excl. GST)</th>
                  {isGst && <th style={cell}>GST%</th>}
                  <th style={cell}>Disc%</th>
                  <th className="num" style={cell}>Amount</th>
                  <th style={cell} />
                </tr></thead>
                <tbody id="saleLines">
                  {lines.map((l, i) => {
                    const it = items.find(x => x.id === l.item_id);
                    const over = !!it && l.qty > it.stock;
                    const tracked = !!it && it.has_serial && (serialStock[l.item_id]?.length ?? 0) > 0;
                    const cols = isGst ? 7 : 6;
                    return (
                      <Fragment key={i}>
                        <tr style={over ? { background: "#fdf6ec" } : undefined}>
                          <td style={{ ...cell, position: "relative", minWidth: 200 }}>
                            {searchRow === i ? (
                              <LiveSearch items={items} getLabel={x => x.name}
                                getSub={x => (x.has_serial ? "S/N · " : "") + x.stock + " left"}
                                width="100%"
                                placeholder="Type to search item…"
                                selectedId={l.item_id || undefined}
                                onPick={x => { pickItem(i, x?.id ?? ""); setSearchRow(null); }} />
                            ) : (
                              <div onClick={() => setSearchRow(i)}
                                style={{ cursor: "pointer", minHeight: 38,
                                  display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <b>{l.name || <span className="mut">Click / F2 to pick item</span>}</b>
                                {it?.has_serial && <span className="chip blu">S/N</span>}
                                {it && (hist[it.id]?.length ?? 0) > 0 && (
                                  <LastPurchaseChip purchases={hist[it.id]}
                                    onOpen={() => setCompare(true)} />)}
                                {over && <span className="chip amb">back order — {it!.stock} left</span>}
                                {it && it.stock <= 0 && <span className="chip red">no stock — sets off on purchase</span>}
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
                          <td style={cell}>
                            <input className="inp mono" type="number" min="0" style={{ width: 54 }}
                              value={l.disc} onKeyDown={rowEnter(i)} onFocus={() => setSearchRow(null)}
                              onChange={e => setL(i, { disc: Math.max(0, +e.target.value || 0) })} /></td>
                          <td className="num" style={{ ...cell, fontWeight: 700,
                              whiteSpace: "nowrap" }}>{inr(net(l))}</td>
                          <td style={cell}>
                            <button type="button" className="ib" title="Remove"
                              onClick={() => rmLine(i)}>✕</button></td>
                        </tr>
                        {/* serial picker — tracked items with in-stock serials */}
                        {tracked && (
                          <tr>
                            <td colSpan={cols} style={{ ...cell, background: "#fbfaf4" }}>
                              <SerialInput qty={l.qty} value={l.serials ?? []}
                                inStock={serialStock[l.item_id]}
                                onChange={v => setL(i, { serials: v })} />
                            </td>
                          </tr>)}
                      </Fragment>);
                    })}
                  {!lines.length && (
                    <tr><td colSpan={isGst ? 7 : 6}>
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
              <input className="inp" name="narr" placeholder="Optional note…" />
              <input type="hidden" name="is_gst" value={isGst ? "1" : "0"} />
            </div>
          </div>
        </div>

        {/* ================= RIGHT: totals + payment ================= */}
        <div className="entry-side">
          <div className="panel">
            <div className="ph"><h3>Bill Summary</h3>
              <span className={"chip " + (isGst ? "grn" : "")}>{isGst ? "GST" : "Non-GST"}</span></div>
            <div className="pb">
              <div className="led-row"><span>Items</span><b>{lines.filter(l => l.item_id).length}</b></div>
              <div className="led-row"><span>Amount (excl. GST)</span><b>{inr(taxable)}</b></div>
              {bd > 0 && <div className="led-row"><span>Bill discount</span><b>− {inr(bd)}</b></div>}
              {isGst && <>
                <div className="led-row"><span>{inter ? "IGST" : "CGST"}</span><b>{inr(inter ? tax : tax / 2)}</b></div>
                {!inter && <div className="led-row"><span>SGST</span><b>{inr(tax / 2)}</b></div>}
              </>}
              <div className="led-row" style={{ borderTop: "2px solid var(--line2)", marginTop: 4 }}>
                <span><b>Total</b></span>
                <b style={{ font: "700 22px var(--font-disp)" }}>{inr(total)}</b></div>

              <div style={{ marginTop: 10 }}>
                <button type="button" className="fchip"
                  onClick={() => { loadHist(lines.map(l => l.item_id)); setCompare(true); }}>
                  📊 Compare purchase prices
                </button>
              </div>

              {serialsIncomplete && (
                <p className="neg" style={{ fontSize: 12, marginTop: 8 }}>
                  ⚠ Select the serial numbers for tracked items (qty per line) before saving.</p>)}

              {/* ---- payment received block ---- */}
              <div style={{ marginTop: 12, borderTop: "1px dashed var(--line)", paddingTop: 10 }}>
                <label className="fl">Amount received now</label>
                <input className="inp mono" type="number" min="0" max={total} step="0.01"
                  value={paid} onChange={e => setPaid(e.target.value)}
                  placeholder="0 = credit bill" />
                <div style={{ height: 8 }} />
                <label className="fl">Mode of payment</label>
                <select className="inp" value={payMode} onChange={e => setPayMode(e.target.value)}>
                  {["cash", "upi", "bank", "cheque"].map(m => <option key={m}>{m}</option>)}
                </select>
                <div className="led-row" style={{ marginTop: 8 }}>
                  <span>Balance due</span>
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
                disabled={pending || !lines.some(l => l.item_id) || serialsIncomplete}>
                💾 Save Invoice (F4)</button>
              <span className="mut" style={{ fontSize: 11 }}>
                Received {paidN > 0 ? inr(paidN) + " via " + payMode.toUpperCase() : "nothing yet — credit bill"}
                {" · "}<b>Alt+1</b> full cash · <b>Alt+2</b> credit</span>
            </div>
          </div>
          {err && <p className="neg" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}
        </div>
      </div>

      {/* purchase price comparison modal */}
      {compare && (
        <PriceCompare items={items} byItem={hist} onClose={() => setCompare(false)}
          onPick={toggleCompare} />
      )}
    </form>
  );
}