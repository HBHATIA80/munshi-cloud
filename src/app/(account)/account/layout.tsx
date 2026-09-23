import { requireCustomer } from "@/lib/auth";
import { AccountTabs } from "@/sections/account/AccountTabs";

export default async function AccountInnerLayout({ children }: { children: React.ReactNode }) {
  const s = await requireCustomer();
  const isShop = s.partyType === "shopkeeper";
  return (
    <>
      <h2 style={{ marginBottom: 6 }}>
        {s.name} <span className="chip" style={{ verticalAlign: "middle", marginLeft: 8 }}>
          {isShop ? "Shopkeeper · trade terms" : "Retail customer"}
        </span>
      </h2>
      <AccountTabs isShop={isShop} extra={[
        { href: "/account/invoices", label: "Invoices" },
        { href: "/account/ledger", label: "My ledger" },
        { href: "/account/receipts", label: "Receipts" },
      ]} />
      {children}
    </>
  );
}