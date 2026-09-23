import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/sections/auth/actions";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  const sb = await createClient();
  let { data: tn } = await sb.from("tenants").select("name,phone")
    .eq("slug", process.env.NEXT_PUBLIC_STORE_SLUG!).maybeSingle();
  if (!tn) { const { data } = await sb.from("tenants").select("name,phone").limit(1); tn = data?.[0] ?? null; }
  return (
    <div id="wrap">
      <div className="tb">
        <a className="brand" href="/">Munshi<em>Cloud</em></a>
        <a className="nl" href="/shop">Shop</a>
        <a className="nl" href="/cart">Cart</a>
        <span style={{ flex: 1 }} />
        {!s && <><a className="nl" href="/login">Log in</a><a className="nl" href="/biz-signup">Start free</a></>}
        {s && <><a className="nl" href="/portfolio">Portfolio</a>
          {s.isSuper && <a className="nl" href="/sa">Platform</a>}</>}
        {s && <form action={logoutAction}><button className="nl">Logout</button></form>}
      </div>
      <div id="view">{children}</div>
      <div className="foot">© {new Date().getFullYear()} {tn?.name ?? ""} · {tn?.phone ?? ""}</div>
    </div>
  );
}