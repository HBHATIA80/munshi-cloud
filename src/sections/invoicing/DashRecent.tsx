"use client";
import type { Voucher, Party } from "@/lib/books";
import { fmt0 } from "@/lib/format";

export function DashRecent({ recent, parties }: {
  recent: Voucher[];
  parties: Party[];
}) {
  return (
    <>
      {recent.map(v => (
        <tr key={v.id}>
          <td>{v.date}</td>
          <td className="mono"><b>{v.no}</b> <span className="chip">{v.type}</span></td>
          <td>{parties.find(p => p.id === v.party_id)?.name ?? "Cash"}</td>
          <td className="num">{fmt0(v.total)}</td>
        </tr>
      ))}
      {!recent.length && (
        <tr><td colSpan={4}><div className="empty">Nothing posted yet.</div></td></tr>
      )}
    </>
  );
}