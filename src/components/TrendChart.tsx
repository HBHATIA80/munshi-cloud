"use client";
import { useState } from "react";

export function TrendChartBtn({ title, data, color = "#2f6b4f" }: {
  title: string;
  data: { day: string; total: number }[];
  color?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!data.length) return null;
  return (
    <>
      <button className="btn" onClick={() => setOpen(true)}>📊 Chart</button>
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 90, padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="panel" style={{ width: 760, maxWidth: "100%", padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              marginBottom: 12 }}>
              <h3 style={{ fontSize: 16 }}>{title} — daily trend</h3>
              <button className="ib" onClick={() => setOpen(false)}>✕</button>
            </div>
            <LineChart data={data} color={color} />
            <p className="mut" style={{ fontSize: 11.5, marginTop: 10 }}>
              Hover the line for exact amounts. Showing {data.length} day{data.length > 1 ? "s" : ""}.</p>
          </div>
        </div>
      )}
    </>
  );
}

function LineChart({ data, color }: { data: { day: string; total: number }[]; color: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 700, H = 260, L = 60, R = 16, T = 16, B = 40;
  const max = Math.max(...data.map(d => d.total), 1);
  const iw = W - L - R, ih = H - T - B;
  const X = (i: number) => L + (data.length > 1 ? i * iw / (data.length - 1) : iw / 2);
  const Y = (v: number) => T + ih - (v / max) * ih;
  const pts = data.map((d, i) => `${X(i)},${Y(d.total)}`).join(" ");
  const area = `M${pts} L${X(data.length - 1)},${T + ih} L${X(0)},${T + ih} Z`;
  const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
  const lblEvery = Math.ceil(data.length / 10);

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
        {[0, 0.5, 1].map(k => (
          <g key={k}>
            <line x1={L} y1={Y(max * k)} x2={W - R} y2={Y(max * k)} stroke="#e5ddcb" />
            <text x={L - 8} y={Y(max * k) + 4} textAnchor="end" fontSize="10"
              fill="#98a0ad" fontFamily="monospace">{inr(max * k)}</text>
          </g>
        ))}
        <path d={area} fill={color} opacity="0.12" />
        <path d={`M${pts}`} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <g key={i}>
            {(hover === i) && <>
              <line x1={X(i)} y1={T} x2={X(i)} y2={T + ih} stroke="#c9c3b2" strokeDasharray="3 3" />
              <circle cx={X(i)} cy={Y(d.total)} r={5} fill={color} stroke="#fff" strokeWidth={2} />
              <text x={X(i)} y={Y(d.total) - 12} textAnchor="middle" fontSize="11"
                fontWeight="700" fill="#26221a">{inr(d.total)}</text>
            </>}
            {i % lblEvery === 0 && (
              <text x={X(i)} y={H - 14} textAnchor="middle" fontSize="9.5" fill="#98a0ad">
                {d.day.slice(2)}</text>
            )}
            <rect x={X(i) - iw / Math.max(data.length - 1, 1) / 2} y={T} width={iw / Math.max(data.length - 1, 1)}
              height={ih} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
          </g>
        ))}
      </svg>
    </div>
  );
}