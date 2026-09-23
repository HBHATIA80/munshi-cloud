"use client";
import { useEffect, useState } from "react";
import { EditVoucher } from "@/sections/invoicing/EditVoucher";
import { MoneyVoucherModal } from "./MoneyVoucherModal";

type Kind = "sale" | "purchase" | "salret" | "purret" | "receipt" | "payment" | "journal";
type V = { id: string; no: string; type: string; kind: Kind };

export function LedgerVoucherClient({ vouchers }: { vouchers: V[] }) {
  const [edit, setEdit] = useState<{ id: string; kind: Kind } | null>(null);

  useEffect(() => {
    // attach click handlers to the ref links rendered server-side
    const links = document.querySelectorAll<HTMLAnchorElement>("[data-voucher]");
    const handlers: Array<[Element, (e: Event) => void]> = [];
    links.forEach(el => {
      const id = el.dataset.voucher!;
      const v = vouchers.find(x => x.id === id);
      if (!v) return;
      const h = (e: Event) => {
        e.preventDefault();
        setEdit({ id: v.id, kind: v.kind });
      };
      el.addEventListener("click", h);
      handlers.push([el, h]);
    });
    return () => handlers.forEach(([el, h]) => el.removeEventListener("click", h));
  }, [vouchers]);

  if (!edit) return null;
  if (edit.kind === "sale" || edit.kind === "purchase") {
    return <EditVoucher voucherId={edit.id} kind={edit.kind}
      onClose={() => setEdit(null)}
      onSaved={() => { setEdit(null); location.reload(); }} />;
  }
  return <MoneyVoucherModal voucherId={edit.id} kind={edit.kind as "receipt" | "payment" | "journal"}
    onClose={() => setEdit(null)}
    onSaved={() => { setEdit(null); location.reload(); }} />;
}