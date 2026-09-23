"use client";
import { useEffect, useState } from "react";

/* Dependency-free charts (SVG/CSS). fmt is a MODE STRING — functions can't cross the RSC boundary. */
const GREEN = "var(--green, #1a7f37)";
const RED = "var(--red, #c62828)";
const BLUE = "var(--blu, #2b6cb0)";

const inr = (n: number) => "₹" + Math.round(+n || 0).toLocaleString("en-IN");
const fmtOf = (mode?: string) => (mode === "inr" ? inr : (n: number) => String(Math.round(+n || 0)));

/* ---------- line chart (multi-series SVG) ---------- */
export function LineChart({ labels, series, height = 220, fmt }: {
  labels: string[];
  series: { name: string; color: string; points: number[] }[];
  height?: number; fmt?: string;
}) {
  const f = fmtOf(fmt);
  if (!labels.length) return <div className="empty">No data to chart.</div>;
  const W = 720, H = height, PL = 56, PR = 12, PT = 12, PB = 24;
  const all = series.flatMap(s => s.points);
  const max = Math.max(0, ...all), min = Math.min(0, ...all);
  const span = max - min || 1;
  const iw = W - PL - PR, ih = H - PT - PB;
  const x = (i: number) => PL + (labels.length === 1 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => PT + ih - ((v - min) / span) * ih;
  const every = Math.ceil(labels.length / 12);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {Array.from({ length: 5 }, (_, t) => {
          const v = min + (span * t) / 4;
          return (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)}
                stroke="var(--line, #ddd)" strokeWidth="1" />
              <text x={PL - 6} y={y(v) + 3} textAnchor="end" fontSize="9"
                fill="var(--mut, #888)">{f(v)}</text>
            </g>);
        })}
        {min < 0 && max > 0 &&
          <line x1={PL} x2={W - PR} y1={y(0)} y2={y(0)} stroke="var(--mut, #999)" strokeWidth="1.5" />}
        {series.map((s, si) => (
          <g key={si}>
            <polyline fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round"
              points={s.points.map((p, i) => `${x(i)},${y(p)}`).join(" ")} />
            {s.points.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p)} r="2.8" fill={s.color}>
                <title>{`${labels[i]} — ${s.name}: ${f(p)}`}</title>
              </circle>))}
          </g>))}
        {labels.map((l, i) => (i % every === 0
          ? <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9"
              fill="var(--mut, #888)">{l.slice(5)}</text>
          : null))}
      </svg>
      <div className="mut" style={{ display: "flex", gap: 14, marginTop: 4, fontSize: 11 }}>
        {series.map((s, i) => (
          <span key={i}><span style={{ display: "inline-block", width: 14, height: 3,
            background: s.color, borderRadius: 2, marginRight: 5, verticalAlign: "middle" }} />{s.name}</span>))}
      </div>
    </div>
  );
}

/* ---------- horizontal bars (kept for comparisons) ---------- */
export function HBars({ data, fmt }: {
  data: { label: string; value: number; color?: string }[]; fmt?: string;
}) {
  const f = fmtOf(fmt);
  if (!data.length) return <div className="empty">No data to chart.</div>;
  const max = Math.max(1, ...data.map(d => Math.abs(d.value)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: "grid",
          gridTemplateColumns: "minmax(90px, 190px) 1fr auto", gap: 8,
          alignItems: "center", fontSize: 12 }}>
          <span title={d.label} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {d.label}</span>
          <div style={{ background: "var(--card2, #f2ecda)", borderRadius: 4, height: 14, position: "relative" }}>
            <div style={{ position: "absolute", top: 0, bottom: 0, borderRadius: 4,
              left: d.value < 0 ? undefined : 0, right: d.value < 0 ? 0 : undefined,
              width: `${Math.max(Math.abs(d.value) / max * 100, 2)}%`,
              background: d.color ?? (d.value < 0 ? RED : GREEN) }} />
          </div>
          <b className={d.value < 0 ? "neg" : ""} style={{ fontSize: 11.5 }}>{f(d.value)}</b>
        </div>))}
    </div>
  );
}

export function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div className="mut" style={{ fontSize: 10, textTransform: "uppercase",
        letterSpacing: ".1em", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

/* ---------- popup modal with all charts for the current P&L view ---------- */
export type DailyPt = { label: string; rev: number; cogs: number; net: number };

export function ChartsModal({ view, daily, items, cats, brands, custs, sups, invs }: {
  view: string;
  daily: DailyPt[];
  items: { label: string; value: number }[];
  cats: { label: string; value: number }[];
  brands: { label: string; value: number }[];
  custs: { label: string; value: number }[];
  sups: { label: string; value: number }[];
  invs: { label: string; value: number }[];
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  const dayAsc = [...daily].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <>
      <button className="btn sm" onClick={() => setOpen(true)}>📈 Charts</button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 95, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="panel" style={{ width: 880, maxWidth: "100%", maxHeight: "90vh",
            overflow: "auto", padding: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>P&amp;L charts</h3>
              <button className="btn sm" onClick={() => setOpen(false)}>✕ Close</button>
            </div>

            <ChartCard title="Revenue vs COGS trend">
              <LineChart fmt="inr" labels={dayAsc.map(d => d.label)}
                series={[
                  { name: "Revenue", color: GREEN, points: dayAsc.map(d => d.rev) },
                  { name: "COGS", color: RED, points: dayAsc.map(d => d.cogs) },
                ]} />
            </ChartCard>

            <ChartCard title="Net profit per day (after that day's expenses)">
              <LineChart fmt="inr" labels={dayAsc.map(d => d.label)}
                series={[{ name: "Net", color: BLUE, points: dayAsc.map(d => d.net) }]} />
            </ChartCard>

            {(view === "sum" || view === "item") && items.length > 0 &&
              <ChartCard title="Top items by profit (loss-makers red)"><HBars data={items} fmt="inr" /></ChartCard>}
            {(view === "sum" || view === "cat") && cats.length > 0 &&
              <ChartCard title="Category profit comparison"><HBars data={cats} fmt="inr" /></ChartCard>}
            {(view === "sum" || view === "brand") && brands.length > 0 &&
              <ChartCard title="Brand profit comparison"><HBars data={brands} fmt="inr" /></ChartCard>}
            {(view === "sum" || view === "cust") && custs.length > 0 &&
              <ChartCard title="Customer profit comparison"><HBars data={custs} fmt="inr" /></ChartCard>}
            {view === "sup" && sups.length > 0 &&
              <ChartCard title="Procurement weight (net bought)"><HBars data={sups} fmt="inr" /></ChartCard>}
            {view === "inv" && invs.length > 0 &&
              <ChartCard title="Best & worst invoices by profit"><HBars data={invs} fmt="inr" /></ChartCard>}
          </div>
        </div>
      )}
    </>
  );
}