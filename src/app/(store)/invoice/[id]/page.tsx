import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { PrintBtn } from "@/sections/store/PrintBtn";

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getSession();
  if (!s) notFound();
  const sb = await createClient();
  // RLS: staff-of-tenant or party-linked customer; anyone else gets null → 404
  const { data: v } = await sb.from("vouchers").select("*").eq("id", id).single();
  if (!v || v.type !== "sale") notFound();
  const [{ data: pt }, { data: tn }, { data: receipts }] = await Promise.all([
    v.party_id
      ? sb.from("parties").select("name,state,gstin,mobile,addr").eq("id", v.party_id).single()
      : Promise.resolve({ data: null }),
    sb.from("tenants").select("name,state,gstin,addr,phone").eq("id", v.tenant_id).single(),
    sb.from("vouchers").select("no,date,total,mode")
      .eq("type", "receipt").eq("party_id", v.party_id ?? "").gte("date", v.date),
  ]);
  if (!tn) notFound();
  const inter = !!(v.is_gst && pt?.state && tn.state && pt.state !== tn.state);
  const due = v.total - (v.paid ?? 0);
  const inr = (n: number) =>
    "₹" + Number(n ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div id="wrap">
      <div className="tb no-print">
        <a className="brand" href="/">Munshi<em>Cloud</em></a>
        <span style={{ flex: 1 }} />
        <a className="nl" href="/portfolio">Portfolio</a>
        <PrintBtn />
      </div>
      <div id="invDoc" className="doc">
        {/* letterhead */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
          flexWrap: "wrap", paddingBottom: 10, borderBottom: "3px double #000" }}>
          <div><h2 style={{ margin: 0, fontSize: 22 }}>{tn.name}</h2>
            <div style={{ fontSize: 11 }}>{tn.addr}<br />Ph: {tn.phone} · GSTIN: {tn.gstin}</div></div>
          <div style={{ textAlign: "right" }}>
            <b style={{ letterSpacing: ".12em" }}>TAX INVOICE</b>
            <div className="mono" style={{ marginTop: 3 }}>{v.no}</div>
            <div style={{ fontSize: 11 }}>Date: {v.date}</div></div>
        </div>

        {/* parties + ref + treatment */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12,
          flexWrap: "wrap", padding: "9px 0" }}>
          <div style={{ fontSize: 11 }}>
            <b>Billed to:</b> {pt?.name ?? "Cash / Counter"}
            {pt?.gstin ? ` · GSTIN ${pt.gstin}` : ""}{pt?.state ? ` · ${pt.state}` : ""}</div>
          <div style={{ fontSize: 11, textAlign: "right" }}>
            {v.ref ? <><b>Ref:</b> {v.ref}<br /></> : null}
            {v.is_gst ? (inter ? "IGST applies (inter-state)" : "CGST + SGST apply (intra-state)")
              : "Non-GST bill"}</div>
        </div>

        {/* items */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, marginTop: 4 }}>
          <thead><tr>
            {["#", "Item", "HSN", "Qty", "Rate", "Taxable"].map(h => (
              <th key={h} style={{ borderTop: "1.5px solid #000", borderBottom: "1.5px solid #000",
                padding: "4px 6px", textAlign: "left" }}>{h}</th>))}
            {v.is_gst && <th style={{ borderTop: "1.5px solid #000", borderBottom: "1.5px solid #000",
              padding: "4px 6px", textAlign: "left" }}>{inter ? "IGST" : "CGST+SGST"}</th>}
            <th style={{ borderTop: "1.5px solid #000", borderBottom: "1.5px solid #000",
              padding: "4px 6px", textAlign: "left" }}>Amount</th>
          </tr></thead>
          <tbody>
            {(v.lines ?? []).map((l: any, i: number) => {
              const net = l._net != null ? Number(l._net) : l.qty * l.rate;
              const tx = l._tax != null ? Number(l._tax) : (v.is_gst ? net * l.gst / 100 : 0);
              return (<tr key={i}>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999" }}>{i + 1}</td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999" }}>{l.name}</td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999" }}>{l.hsn || ""}</td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999", textAlign: "right" }}>{l.qty}</td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999", textAlign: "right" }}>{Number(l.rate).toFixed(2)}</td>
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999", textAlign: "right" }}>{net.toFixed(2)}</td>
                {v.is_gst && <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999", textAlign: "right" }}>{tx.toFixed(2)}</td>}
                <td style={{ padding: "3.5px 6px", borderBottom: "1px solid #999", textAlign: "right" }}>{(net + tx).toFixed(2)}</td>
              </tr>);})}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700 }}>
              <td colSpan={v.is_gst ? 6 : 5} style={{ padding: "4px 6px" }}>Taxable value</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{Number(v.taxable).toFixed(2)}</td>
              {v.is_gst && <td style={{ padding: "4px 6px" }} />}
              <td style={{ padding: "4px 6px" }} /></tr>
            {v.is_gst && <tr>
              <td colSpan={v.is_gst ? 6 : 5} style={{ padding: "4px 6px" }}>
                {inter ? "IGST" : "CGST " + (v.tax / 2).toFixed(2) + " + SGST " + (v.tax / 2).toFixed(2)}</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{Number(v.tax).toFixed(2)}</td>
              {v.is_gst && <td style={{ padding: "4px 6px" }} />}
              <td style={{ padding: "4px 6px" }} /></tr>}
            <tr style={{ borderTop: "3px double #000", fontWeight: 700, fontSize: 12 }}>
              <td colSpan={v.is_gst ? 6 : 5} style={{ padding: "4px 6px" }}>Grand Total</td>
              <td style={{ padding: "4px 6px", textAlign: "right" }}>{Number(v.total).toFixed(2)}</td>
              {v.is_gst && <td style={{ padding: "4px 6px" }} />}
              <td style={{ padding: "4px 6px" }} /></tr>
          </tfoot>
        </table>

        {/* payments received */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <table style={{ fontSize: 11, minWidth: 280 }}>
            <thead><tr><th colSpan={2} style={{ textAlign: "left",
              borderBottom: "1.5px solid #000", padding: "3px 6px" }}>PAYMENTS RECEIVED</th></tr></thead>
            <tbody>
              {(receipts ?? []).map((r: any) => (
                <tr key={r.no}><td>{r.no} · {r.date}</td>
                  <td style={{ textAlign: "right" }}>{r.mode} — {inr(r.total)}</td></tr>))}
              {!(receipts ?? []).length && (
                <tr><td>No separate payments yet</td>
                  <td style={{ textAlign: "right" }}>—</td></tr>)}
              <tr style={{ fontWeight: 700 }}>
                <td>Paid total</td><td style={{ textAlign: "right" }}>{inr(v.paid)}</td></tr>
              {due > 0 && <tr style={{ fontWeight: 700 }}>
                <td>Balance due</td>
                <td style={{ textAlign: "right", color: "#a8402e" }}>{inr(due)}</td></tr>}
              {due <= 0 && <tr style={{ fontWeight: 700, color: "#0f7a4d" }}>
                <td colSpan={2}>FULLY PAID ✓</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ fontStyle: "italic", marginTop: 6, fontSize: 11.5 }}>
          E. &amp; O.E. — Goods once sold are subject to shop policy.</div>
      </div>
      <div className="no-print" style={{ textAlign: "center", padding: 20 }}>
        <Link className="btn" href="/account">← My account</Link>
      </div>
    </div>
  );
}