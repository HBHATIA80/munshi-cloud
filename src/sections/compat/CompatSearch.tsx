"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Sug = { gid: string; mid: string; label: string; sub: string };

export function CompatSearch({ sugs, big }: { sugs: Sug[]; big?: boolean }) {
  const [q, setQ] = useState("");
  const [focus, setFocus] = useState(false);
  const router = useRouter();

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = useMemo(() => {
    if (!terms.length) return sugs.slice(0, 6);           // idle: show a few examples
    return sugs.filter(s => {
      const hay = (s.label + " " + s.sub).toLowerCase();
      return terms.every(t => hay.includes(t));
    }).slice(0, 10);
  }, [sugs, terms]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = focus || q.length > 0;

  return (
    <div style={{ position: "relative", maxWidth: big ? 640 : 560, margin: big ? "0 auto" : undefined }}>
      <input
        className="inp"
        style={{ fontSize: big ? 17 : 14.5, padding: big ? "13px 16px 13px 42px" : "10px 12px 10px 36px",
          borderRadius: 12, width: "100%" }}
        placeholder={big ? "Search your phone — e.g. V27, Galaxy S23, Redmi Note 13…"
                          : "Find parts for your phone — try “V27”…"}
        value={q}
        onChange={e => setQ(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
      />
      <span style={{ position: "absolute", left: 14, top: big ? 15 : 11, fontSize: big ? 17 : 14,
        opacity: .55, pointerEvents: "none" }}>🔍</span>

      {open && (
        <div style={{ position: "absolute", zIndex: 60, left: 0, right: 0, top: "calc(100% + 6px)",
          background: "var(--card, #fff)", border: "1px solid var(--line)",
          borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 34px rgba(0,0,0,.14)" }}>
          {filtered.map(s => (
            <button key={s.gid + s.mid} className="led-row"
              style={{ display: "flex", width: "100%", textAlign: "left", gap: 10,
                padding: "10px 14px", border: 0, borderBottom: "1px solid var(--line)",
                background: "transparent", cursor: "pointer" }}
              onMouseDown={e => e.preventDefault()}
              onClick={() => router.push(`/compat?g=${s.gid}&m=${s.mid}`)}>
              <span style={{ fontWeight: 700, fontSize: 13.5, whiteSpace: "nowrap" }}>{s.label}</span>
              <span className="mut" style={{ fontSize: 12.5, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.sub}</span>
              <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--mut, #888)",
                whiteSpace: "nowrap" }}>view →</span>
            </button>
          ))}
          {!filtered.length && (
            <div className="empty" style={{ padding: 14 }}>
              No mapped parts match “{q}” yet — new models are added regularly.
            </div>)}
          {!terms.length && (
            <div className="mut" style={{ fontSize: 11, padding: "7px 14px" }}>
              Popular right now — type to search all models &amp; parts.
            </div>)}
        </div>
      )}
    </div>
  );
}