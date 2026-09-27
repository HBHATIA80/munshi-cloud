"use client";
import { useEffect, useRef } from "react";

/* Styled modal replacement for window.alert / window.confirm. */
export function UiModal({ open, kind, title, message, confirmLabel, cancelLabel,
  onConfirm, onClose, busy }: {
  open: boolean;
  kind: "success" | "danger" | "info";
  title: string;
  message?: string;
  confirmLabel?: string;          // omit → single Close button
  cancelLabel?: string;
  onConfirm?: () => void;
  onClose: () => void;
  busy?: boolean;
}) {
  const ok = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) ok.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;

  const icon = kind === "success" ? "✅" : kind === "danger" ? "⚠️" : "ℹ️";
  const accent = kind === "success" ? "var(--green, #1a7f37)"
    : kind === "danger" ? "var(--red, #c62828)" : "var(--brand)";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 97, padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel" style={{ width: 420, maxWidth: "100%", padding: 20 }}>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ width: 40, height: 40, borderRadius: 99, flex: "none",
            background: accent, color: "#fff", display: "grid", placeItems: "center",
            fontSize: 18 }}>{icon}</div>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: "2px 0 4px" }}>{title}</h3>
            {message && <div className="mut" style={{ fontSize: 13, lineHeight: 1.55,
              whiteSpace: "pre-line" }}>{message}</div>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 9, justifyContent: "flex-end", marginTop: 18 }}>
          {cancelLabel && onConfirm && (
            <button type="button" className="btn" disabled={busy} onClick={onClose}>
              {cancelLabel}</button>)}
          <button type="button" ref={ok}
            className={"btn " + (kind === "danger" ? "dng" : "pri")}
            disabled={busy}
            onClick={() => { if (onConfirm) onConfirm(); else onClose(); }}>
            {busy ? "Working…" : (confirmLabel ?? "OK")}</button>
        </div>
      </div>
    </div>
  );
}