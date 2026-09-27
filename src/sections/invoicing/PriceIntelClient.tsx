"use client";
import { useMemo, useState } from "react";
import { PriceCompare } from "./PriceIntel";

type PU = { no: string; date: string; qty: number; rate: number; supplier: string };
type Item = { id: string; name: string; sku: string; cost: number };

/* Standalone page wrapper around the same PriceCompare modal used in
   SaleEntry / PurchEntry. All history is preloaded server-side, so
   adding an item to the comparison is instant (no fetching). */
export function PriceIntelClient({ items, allHist, initial }: {
  items: Item[];
  allHist: Record<string, PU[]>;
  initial: string[];
}) {
  const [shown, setShown] = useState<string[]>(initial);
  const [open, setOpen] = useState(true);

  // only the selected items' history goes into the modal
  const byItem = useMemo(() => {
    const out: Record<string, PU[]> = {};
    for (const id of shown) if (allHist[id]) out[id] = allHist[id];
    return out;
  }, [shown, allHist]);

  // same toggle contract as the entry forms: add if absent, remove if present
  const toggle = (id: string) =>
    setShown(s => (s.includes(id) ? s.filter(x => x !== id) : [...s, id]));

  const nameOf = (id: string) => items.find(i => i.id === id)?.name ?? id;

  return (
    <>
      <div className="ph" style={{ marginBottom: 10 }}>
        <h2>Purchase price comparison</h2>
        <p className="mut" style={{ fontSize: 12 }}>
          Last 5 purchase bills per item — spot cost drift and verify supplier rates.</p>
      </div>

      <div className="tool" style={{ flexWrap: "wrap" }}>
        <button className="btn pri" onClick={() => setOpen(true)}>
          📊 Open comparison ({shown.length})</button>
        {shown.map(id => (
          <span key={id} className="chip" style={{ fontSize: 12 }}>
            {nameOf(id)}
            <button className="ib" style={{ marginLeft: 4 }} title="Remove"
              onClick={() => toggle(id)}>✕</button>
          </span>))}
        {!shown.length && <span className="mut" style={{ fontSize: 12 }}>
          Nothing selected — open the comparison and add items.</span>}
      </div>

      <PriceCompare items={items} byItem={byItem}
        onClose={() => setOpen(false)} onPick={toggle} />
    </>
  );
}