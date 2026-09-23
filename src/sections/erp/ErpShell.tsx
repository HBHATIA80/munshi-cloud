"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import { setActiveTenantAction } from "@/sections/auth/actions";
import { NotifBell } from "@/components/NotifBell";

const NAV = [
  { sec: "Daily", items: [
    { href: "/erp", label: "Dashboard", icon: "◧" },
    { href: "/erp/orders", label: "Online Orders", icon: "✉" },
    { href: "/erp/daybook", label: "Day Book", icon: "▤" },
  ]},
  { sec: "Sales", items: [
    { href: "/erp/sale", label: "New Invoice", icon: "＋" },
    { href: "/erp/sales", label: "Sales Register", icon: "☰" },
    { href: "/erp/rcpt", label: "Receipts", icon: "↙" },
  ]},
  { sec: "Purchase", items: [
    { href: "/erp/purch", label: "New Purchase", icon: "＋" },
    { href: "/erp/purchreg", label: "Purchase Register", icon: "☰" },
    { href: "/erp/pay", label: "Payments", icon: "↗" },
  ]},
  { sec: "Returns", items: [
    { href: "/erp/returns", label: "Credit / Debit Notes", icon: "⇄" },
  ]},
  { sec: "Masters", items: [
    { href: "/erp/items", label: "Items", icon: "▦" },
    { href: "/erp/parties", label: "Parties", icon: "◔" },
    { href: "/erp/cats", label: "Categories & Brands", icon: "◈" },
    { href: "/erp/compat", label: "Part Compatibility", icon: "🔗" },
  ]},
  { sec: "Accounts", items: [
    { href: "/erp/ledger", label: "Party Ledgers", icon: "❑" },
    { href: "/erp/reports", label: "Reports", icon: "◫" },
    { href: "/erp/books", label: "Books of Accounts", icon: "❒" },
    { href: "/erp/journal", label: "Party Journals", icon: "⇉" },
  ]},
  { sec: "Owner", items: [
    { href: "/erp/expenses", label: "Expenses", icon: "₹" },
    { href: "/erp/users", label: "Users & Roles", icon: "◉" },
    { href: "/erp/settings", label: "Settings", icon: "⚙" },
  ]},
];

export type ErpMembership = { tenantId: string; name: string; role: string };
export type ErpUser = { name: string; mobile: string | null; role: string; status: string };

export function ErpShell({ shopName, role, memberships, activeTenantId, user, logout, children }: {
  shopName: string;
  role: string;
  memberships: ErpMembership[];
  activeTenantId: string;
  user: ErpUser;
  logout: React.ReactNode;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ms = memberships ?? [];
  const switchable = ms.filter(m => m.role === "admin" || m.role === "staff");

  const nav = NAV
    .map(s => ({
      ...s,
      items: s.items.filter(i =>
        (i.href !== "/erp/users" && i.href !== "/erp/settings" && i.href !== "/erp/compat")
        || role === "admin"),
    }))
    .filter(s => s.items.length);

  const switchTo = (id: string) => start(async () => {
    await setActiveTenantAction(id);
    router.refresh();
  });

  const u = user ?? { name: "", mobile: null, role: role, status: "Active" };
  const initials = (u.name || "U").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div id="erpWrap">
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(20,15,5,.45)", zIndex: 45 }} />
      )}

      <aside id="side" className={open ? "open" : ""}>
        <div className="lg" onClick={() => { setOpen(false); window.location.href = "/"; }}>
          <b>Munshi<em>Cloud</em></b>
          <p>{shopName} · {role}</p>
        </div>

        <nav onClick={e => e.stopPropagation()}>
          {nav.map(s => (
            <div key={s.sec}>
              <div className="sn">{s.sec}</div>
              {s.items.map(i => (
                <Link key={i.href} href={i.href}
                  className={"si" + (path === i.href ? " on" : "")}
                  onClick={() => setOpen(false)}>
                  <span style={{ width: 16, textAlign: "center", flex: "none" }}>{i.icon}</span>
                  <span>{i.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        {/* profile card — logged-in identity */}
        <div style={{ margin: "14px 14px 0", padding: "12px 14px",
          background: "rgba(255,255,255,.06)", borderRadius: 12,
          border: "1px solid rgba(255,255,255,.1)" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 99, flex: "none",
              background: "var(--brand)", color: "#fff", display: "grid", placeItems: "center",
              fontWeight: 700, fontSize: 14 }}>{initials}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {user.name}</div>
              <div className="mono" style={{ fontSize: 10.5, color: "#98927e" }}>
                {user.mobile ?? "—"}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
            <span className="chip blu">{role}</span>
            <span className="chip grn">{user.status}</span>
          </div>
        </div>

        <div className="ft">
          <Link className="si" href="/portfolio" onClick={() => setOpen(false)}>
            <span style={{ width: 16, textAlign: "center", flex: "none" }}>❐</span>
            <span>My portfolio</span>
          </Link>
          <Link className="si" href="/" onClick={() => setOpen(false)}>
            <span style={{ width: 16, textAlign: "center", flex: "none" }}>⌂</span>
            <span>Storefront</span>
          </Link>
        </div>
      </aside>

      <div id="erpMain">
        <div id="erpTop">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn sm" id="menuBtn" onClick={() => setOpen(!open)}>☰</button>
            {switchable.length > 1 && (
              <select className="inp mono" style={{ width: 210, fontSize: 12.5 }}
                disabled={pending} value={activeTenantId}
                onChange={e => switchTo(e.target.value)}>
                {switchable.map(m => (
                  <option key={m.tenantId} value={m.tenantId}>{m.name}</option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a className="btn" href="/portfolio">❐ Portfolio</a>
            <a className="btn" href="/shop">⌂ Store</a>
            <NotifBell />
            {logout}
          </div>
        </div>
        <div id="erpView">{children}</div>
      </div>
    </div>
  );
}