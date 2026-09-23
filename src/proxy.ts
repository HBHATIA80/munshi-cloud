import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(req: NextRequest) {
  let res = NextResponse.next();
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next();
          list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        },
    } }
  );
  const { data: { user } } = await sb.auth.getUser();
  const p = req.nextUrl.pathname;
  const guarded = p.startsWith("/erp") || p.startsWith("/account") || p.startsWith("/sa") || p.startsWith("/portfolio");

  if (!user) return guarded ? NextResponse.redirect(new URL("/login", req.url)) : res;

  if (guarded) {
    const { data: prof } = await sb.from("profiles").select("role,status").eq("id", user.id).single();
    if (!prof || prof.status !== "active") {
      await sb.auth.signOut();
      return NextResponse.redirect(new URL("/login", req.url));
    }
    if (p.startsWith("/sa")) {
      if (prof.role !== "superadmin")
        return NextResponse.redirect(new URL("/portfolio", req.url));
      return res;
    }
    // membership checks
    const { data: ms } = await sb.from("memberships")
      .select("tenant_id,role").eq("user_id", user.id).eq("status", "active");
    const active = req.cookies.get("mc_t")?.value;
    const inTenant = ms?.find(m => m.tenant_id === active);
    const anyStaff = ms?.some(m => m.role === "admin" || m.role === "staff");

    if (p.startsWith("/erp")) {
      if (!anyStaff) return NextResponse.redirect(new URL("/portfolio", req.url));
      if (!inTenant || !(inTenant.role === "admin" || inTenant.role === "staff"))
        return NextResponse.redirect(new URL("/portfolio", req.url));
    }
    if (p.startsWith("/account")) {
      if (!inTenant || inTenant.role !== "customer")
        return NextResponse.redirect(new URL("/portfolio", req.url));
    }
  }
  return res;
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"] };