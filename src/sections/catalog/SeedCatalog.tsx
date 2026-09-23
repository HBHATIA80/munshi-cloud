"use client";
import { useState, useTransition } from "react";
import { seedCatalogAction } from "./seed";
import { TRADE_TEMPLATES } from "@/lib/templates";

export function SeedCatalog({ hasCatalog }: { hasCatalog: boolean }) {
  const [trade, setTrade] = useState("mobile");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="panel" style={{ marginBottom: 14 }}>
      <div className="ph"><h3>Quick start — load a starter catalog</h3></div>
      <div className="pb" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="inp" style={{ width: 260 }} value={trade} onChange={e => setTrade(e.target.value)}>
          {Object.entries(TRADE_TEMPLATES).map(([k, t]) => (
            <option key={k} value={k}>{t.label}</option>))}
        </select>
        <button className="btn pri" disabled={pending}
          onClick={() => start(async () => {
            setMsg("");
            if (hasCatalog && !confirm("Add these categories/brands alongside your existing ones?")) return;
            const r = await seedCatalogAction(trade);
            if (r.error) setMsg(r.error);
            else setMsg(`Added ${r.cats ?? 0} categories & ${r.brands ?? 0} brands — edit or delete anything that doesn't fit.`);
          })}>
          {pending ? "Loading…" : "Load starter catalog"}</button>
        {msg && <span className={msg.startsWith("Added") ? "pos" : "neg"} style={{ fontSize: 13 }}>{msg}</span>}
        <span className="mut" style={{ fontSize: 12 }}>
          Categories, sub-categories &amp; brands — then just add items with photos.</span>
      </div>
    </div>
  );
}