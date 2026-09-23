import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export const revalidate = 30;

export default async function ShopMarketplace() {
  const sb = await createClient();
  const { data: tenants } = await sb.from("tenants")
    .select("slug,name,state").eq("status", "active").order("name");
  return (
    <>
      <div className="hero">
        <h1>Shop the marketplace<br />
          <span style={{ opacity: .75, fontSize: ".62em", fontStyle: "italic" }}>
            every business on MunshiCloud, one cart per shop</span></h1>
        <p>Wholesale &amp; retail across verified traders. Log in — shopkeepers see trade prices.</p>
      </div>
      <div className="pgrid">
        {(tenants ?? []).map(t => (
          <Link className="pcard" key={t.slug} href={`/shop/${t.slug}`} style={{ padding: 18 }}>
            <div style={{ fontSize: 30 }}>🏪</div>
            <div className="nm" style={{ fontSize: 15, marginTop: 8 }}>{t.name}</div>
            <div className="mut" style={{ fontSize: 11.5, marginTop: 4 }}>/shop/{t.slug} · {t.state || "India"}</div>
            <div style={{ marginTop: 10 }}><span className="chip">Open shop →</span></div>
          </Link>))}
      </div>
    </>
  );
}