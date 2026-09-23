"use client";
import { useRouter } from "next/navigation";
import { LiveSearch } from "@/components/LiveSearch";

export function LedgerPicker({ parties, current }: {
  parties: { id: string; name: string; type: string }[]; current: string }) {
  const router = useRouter();
  return (
    <div style={{ maxWidth: 280 }}>
      <LiveSearch items={parties} getLabel={p => p.name} getSub={p => p.type}
        placeholder="Search party…" selectedId={current || undefined}
        onPick={p => router.push("/erp/ledger?p=" + (p?.id ?? ""))} />
    </div>
  );
}