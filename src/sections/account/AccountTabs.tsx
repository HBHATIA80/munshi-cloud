"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
];

export function AccountTabs({ isShop, extra }: { isShop: boolean; extra: { href: string; label: string }[] }) {
  const path = usePathname();
  const tabs = [...TABS, ...(isShop ? extra : [])];
  return (
    <div className="tool">
      {tabs.map(t => (
        <Link key={t.href} className={"fchip" + (path === t.href ? " on" : "")} href={t.href}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}