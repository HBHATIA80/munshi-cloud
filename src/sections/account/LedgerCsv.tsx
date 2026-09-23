"use client";
import { downloadCsv } from "@/lib/csv";

export function LedgerCsv({ rows }: { rows: { date: string; part: string; no: string; dr: number; cr: number }[] }) {
  return (
    <button className="btn sm" onClick={() => downloadCsv("my-ledger.csv",
      [["Date", "Particulars", "Ref", "Debit", "Credit"],
       ...rows.map(r => [r.date, r.part, r.no, r.dr || "", r.cr || ""])])}>
      ⭳ Export CSV
    </button>
  );
}