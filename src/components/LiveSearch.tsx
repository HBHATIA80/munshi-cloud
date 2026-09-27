"use client";
import { useEffect, useMemo, useRef, useState } from "react";

/* Keyboard-first picker:
   ↑/↓ navigate · Enter or Tab selects (first row pre-highlighted) · Esc closes.
   Shows top matches on focus even before typing. */
export function LiveSearch<T extends { id?: string }>({
  items, getLabel, getSub, placeholder, selectedId, onPick,
  width, allowAdd, onAdd,
}: {
  items: T[];
  getLabel: (t: T) => string;
  getSub?: (t: T) => string;
  placeholder?: string;
  selectedId?: string;
  onPick: (t: T | null) => void;
  width?: string;
  allowAdd?: boolean;
  onAdd?: (name: string) => Promise<{ id?: string; error?: string } | null>;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const [busyAdd, setBusyAdd] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => (selectedId ? items.find(x => (x as any).id === selectedId) : undefined),
    [items, selectedId]);

  const fl = q.trim().toLowerCase();
  const filtered = useMemo(() => {
    const base = fl
      ? items.filter(x =>
          getLabel(x).toLowerCase().includes(fl) ||
          (getSub ? getSub(x).toLowerCase().includes(fl) : false))
      : items;
    return base.slice(0, 10);                     // dropdown cap; typing narrows further
  }, [items, fl, getLabel, getSub]);

  const showAdd = !!allowAdd && fl.length > 0 &&
    !filtered.some(x => getLabel(x).toLowerCase() === fl);
  const rowCount = filtered.length + (showAdd ? 1 : 0);
  const openNow = open && rowCount > 0;

  useEffect(() => { setHi(0); }, [q]);            // first row pre-highlighted on every list change
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${hi}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [hi, openNow, q]);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (t: T) => { setOpen(false); setQ(""); onPick(t); };

  const tryAdd = async () => {
    if (!onAdd || !fl || busyAdd) return;
    setBusyAdd(true);
    const r = await onAdd(q.trim());
    setBusyAdd(false);
    if (r && (r as any).id) pick(r as unknown as T);   // caller already stored it; select it
    // on null/error: keep open — the caller has shown its own error message
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!openNow) { setOpen(true); return; }
      setHi(h => (h + 1) % Math.max(1, rowCount));
    } else if (e.key === "ArrowUp") {
      if (!openNow) return;
      e.preventDefault();
      setHi(h => (h - 1 + Math.max(1, rowCount)) % Math.max(1, rowCount));
    } else if (e.key === "Enter") {
      if (!openNow) return;                    // closed → let Enter do its normal job
      e.preventDefault();
      if (showAdd && hi === filtered.length) tryAdd();
      else if (filtered[hi]) pick(filtered[hi]);
    } else if (e.key === "Tab") {
      if (openNow && hi < rowCount) {          // Tab = select highlighted, stay in flow
        e.preventDefault();
        if (showAdd && hi === filtered.length) tryAdd();
        else if (filtered[hi]) pick(filtered[hi]);
      }                                        // closed → Tab moves focus normally
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const hl = (i: number) => i === hi
    ? { background: "var(--card2, #f2ecda)", cursor: "pointer" }
    : { background: "transparent", cursor: "pointer" };

  return (
    <div ref={wrap} style={{ position: "relative", width: width ?? undefined }}>
      <input
        className="inp ls-input"
        style={{ width: "100%" }}
        placeholder={placeholder ?? "Type to search…"}
        value={q !== "" ? q : (selected ? getLabel(selected) : "")}
        onChange={e => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onFocus={() => { setOpen(true); setHi(0); }}
        onKeyDown={onKey}
        autoComplete="off"
      />
      {openNow && (
        <div ref={listRef}
          style={{ position: "absolute", zIndex: 70, left: 0, right: 0,
            top: "calc(100% + 4px)", background: "var(--card, #fff)",
            border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden",
            boxShadow: "0 10px 30px rgba(0,0,0,.14)", maxHeight: 264, overflowY: "auto",
            overscrollBehavior: "contain" }}>
          {filtered.map((x, i) => (
            <div key={(x as any).id ?? i} data-idx={i} style={{ ...hl(i),
              display: "flex", gap: 8, alignItems: "center",
              padding: "8px 12px", borderBottom: "1px solid var(--line)" }}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(x)}>
              <b style={{ fontSize: 13, whiteSpace: "nowrap" }}>{getLabel(x)}</b>
              {getSub && <span className="mut" style={{ fontSize: 11.5,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {getSub(x)}</span>}
              {selectedId && (x as any).id === selectedId &&
                <span style={{ marginLeft: "auto" }} className="chip grn">✓</span>}
            </div>))}
          {showAdd && (
            <div data-idx={filtered.length} style={{ ...hl(filtered.length),
              display: "flex", gap: 8, alignItems: "center",
              padding: "8px 12px", fontWeight: 600 }}
              onMouseEnter={() => setHi(filtered.length)}
              onMouseDown={e => e.preventDefault()}
              onClick={tryAdd}>
              {busyAdd ? "Saving…" : <>＋ Add “{q.trim()}”</>}
            </div>)}
          <div className="mut" style={{ fontSize: 10, padding: "5px 12px",
            borderTop: "1px solid var(--line)" }}>
            ↑↓ navigate · Enter / Tab select · Esc close</div>
        </div>)}
    </div>
  );
}