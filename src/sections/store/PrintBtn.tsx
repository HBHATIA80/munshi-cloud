"use client";
export function PrintBtn() {
  return <button className="btn pri" onClick={() => window.print()}>🖨 Print / PDF</button>;
}