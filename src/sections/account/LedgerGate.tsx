"use client";

export function LedgerGate({ shopName }: { shopName: string }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(30,25,12,.55)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 96, padding: 16 }}>
      <div className="panel" style={{ width: 430, maxWidth: "100%", padding: 22, textAlign: "center" }}>
        <div style={{ width: 48, height: 48, borderRadius: 99, margin: "0 auto 10px",
          background: "var(--amber, #b8860b)", color: "#fff", display: "grid",
          placeItems: "center", fontSize: 22 }}>🔒</div>
        <h3 style={{ margin: "0 0 6px" }}>Ledger access is locked</h3>
        <p className="mut" style={{ fontSize: 13.5, lineHeight: 1.6 }}>
          <b>{shopName}</b> needs to upgrade its plan for you to view your
          ledger (invoices, receipts &amp; balances).<br /><br />
          Contact the shop to upgrade — once upgraded, your ledger unlocks automatically.</p>
        <a className="btn pri" style={{ marginTop: 14, justifyContent: "center" }}
          href="/account">← Back to my account</a>
      </div>
    </div>
  );
}