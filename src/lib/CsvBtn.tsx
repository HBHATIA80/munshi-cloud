"use client";
import { downloadCsv } from "./csv";

export function CsvBtn({ name, rows }: { name: string; rows: (string | number)[][] }) {
  return (
    <button className="btn sm" onClick={() => downloadCsv(name, rows)}>⭳ CSV</button>
  );
}