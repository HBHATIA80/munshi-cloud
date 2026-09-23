import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { StoreBrowser } from "@/sections/store/StoreBrowser";
import { TenantFonts } from "@/components/TenantFonts";

export const revalidate = 30;

export default async function TenantShop({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = await createClient();
  const s = await getSession();
  const { data: tn } = await sb.from("tenants")
    .select("id,name,slug,state,status,settings").eq("slug", slug).maybeSingle();
  if (!tn || tn.status !== "active") notFound();

  const [{ data: cats }, { data: items }, { data: brands }, { data: pRow }] = await Promise.all([
    sb.from("categories").select("*").eq("tenant_id", tn.id).order("name"),
    sb.from("items")
      .select("id,name,sku,unit,pr,ps,mrp,stock,low,image_url,cat_id,sub_id,brand_id")
      .eq("tenant_id", tn.id).order("name"),
    sb.from("brands").select("*").eq("tenant_id", tn.id).order("name"),
    s ? sb.from("parties").select("type").eq("user_id", s.userId).eq("tenant_id", tn.id).limit(1)
      : { data: null },
  ]);
  const trade = (pRow?.[0]?.type ?? "") === "shopkeeper";
  const joined = s ? s.memberships.some(m => m.tenantId === tn.id) : false;
  const st = (tn.settings ?? {}) as { font_body?: string; font_disp?: string };

  return (
    <>
      <TenantFonts fontBody={st.font_body} fontDisp={st.font_disp} />
      <div className="hero">
        <h1>{tn.name}<br />
          <span style={{ opacity: .75, fontSize: ".62em", fontStyle: "italic" }}>
            genuine parts · fair prices · {tn.state || "India"}</span></h1>
        <p>
          {trade
            ? <>You're seeing your <b>wholesale trade prices</b> in this shop.</>
            : <>Wholesale &amp; retail. Shopkeepers: log in for trade prices.</>}
          {!joined && s
            ? <> Use this shop's join code to link your account for ledgers &amp; credit.</>
            : !s ? <> Create an account to order.</> : null}
        </p>
        <div className="cta">
          <a className="btn pri" href="#catalog">Browse ↓</a>
          {!joined && !s && (
            <a className="btn" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}
              href="/signup">Create account</a>)}
        </div>
      </div>
      <div id="catalog">
        <StoreBrowser items={(items ?? []) as any} cats={(cats ?? []) as any}
          brands={(brands ?? []) as any} trade={trade} tenantId={tn.id} />
      </div>
    </>
  );
}