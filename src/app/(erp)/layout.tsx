import { requireStaff } from "@/lib/auth";
import { ErpShell } from "@/sections/erp/ErpShell";
import { LogoutBtn } from "@/sections/erp/LogoutBtn";

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const s = await requireStaff();
  return (
    <ErpShell
      shopName={s.tenant?.name ?? "Shop"}
      role={s.role ?? "staff"}
      memberships={s.memberships
        .filter(m => m.role === "admin" || m.role === "staff")
        .map(m => ({ tenantId: m.tenantId, name: m.tenant.name, role: m.role }))}
      activeTenantId={s.tenantId ?? ""}
      user={{ name: s.name, mobile: s.mobile, role: s.role ?? "staff", status: "Active" }}
      logout={<LogoutBtn />}>
      {children}
    </ErpShell>
  );
}