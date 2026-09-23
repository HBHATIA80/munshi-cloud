/* ============================================================
   MunshiCloud — shared accounting helpers
   Pure functions only: no DB access, safe on server & client.
   Sign convention: party perspective — Dr (they owe the shop) is +.
============================================================ */

export type VLine = {
  item_id?: string;
  name: string;
  unit?: string;
  hsn?: string;
  qty: number;
  rate: number;
  disc?: number;
  gst: number;
  cost?: number;
  _net?: number;
  _tax?: number;
};

export type Voucher = {
  id: string;
  no: string;
  type: string;            // sale | purchase | receipt | payment | salret | purret | journal
  date: string;
  party_id: string | null;
  is_gst: boolean;
  taxable: number;
  tax: number;
  total: number;
  paid: number;
  mode: string;
  narr: string | null;
  lines: VLine[];
};

export type Party = {
  id: string;
  name: string;
  type: string;            // customer | retailer | shopkeeper | supplier
  open: number;
  state: string | null;
  mobile: string | null;
  gstin?: string | null;
  addr?: string | null;
  user_id?: string | null; // set = app-linked (portal login)
};

export const pad = (n: number, l = 4) => String(n).padStart(l, "0");

/**
 * Party balance from vouchers + opening.  + = Dr (they owe the shop), − = Cr.
 * Journal pairs: leg "-A" (From party) is a DEBIT (+), leg "-B" (To party) is a CREDIT (−).
 * Guards with String(v.no ?? "") because some callers select narrow voucher columns.
 */
export function partyBalance(vs: Voucher[], p: Party): number {
  let b = +p.open || 0;
  for (const v of vs) {
    if (v.party_id !== p.id) continue;
    switch (v.type) {
      case "sale":     b += v.total; break;   // they bought → owe more
      case "purret":   b += v.total; break;   // debit note → owe more
      case "payment":  b += v.total; break;   // we paid them → owe more
      case "salret":   b -= v.total; break;   // credit note → owe less
      case "purchase": b -= v.total; break;   // we bought → owe less
      case "receipt":  b -= v.total; break;   // they paid → owe less
      case "journal": {                        // party-to-party transfer leg
        const no = String(v.no ?? "");         // guard: callers may not select `no`
        if (no.endsWith("-A")) b += v.total;   // From party debited
        else if (no.endsWith("-B")) b -= v.total; // To party credited
        break;
      }
    }
  }
  return Math.round(b * 100) / 100;
}

/** Ledger rows for one party, chronological. dr/cr in party perspective. */
export function ledgerRows(vs: Voucher[], partyId: string): {
  date: string; part: string; no: string; dr: number; cr: number;
}[] {
  const label: Record<string, string> = {
    sale: "Sales invoice",
    salret: "Credit note (sales return)",
    purchase: "Purchase bill",
    purret: "Debit note (purchase return)",
    receipt: "Receipt",
    payment: "Payment",
    journal: "Journal transfer",
  };
  const rows: { date: string; part: string; no: string; dr: number; cr: number }[] = [];
  for (const v of vs) {
    if (v.party_id !== partyId) continue;
    let dr = 0, cr = 0;
    if (v.type === "sale" || v.type === "purret" || v.type === "payment") dr = v.total;
    else if (v.type === "journal") {
      const no = String(v.no ?? "");            // guard: caller may not select `no`
      if (no.endsWith("-A")) dr = v.total;      // From party leg = Debit
      else cr = v.total;                         // To party leg = Credit
    }
    else cr = v.total;
    const kind = label[v.type] ?? v.type;
    const part = kind + ((v.type === "receipt" || v.type === "payment") && v.mode ? " · " + v.mode : "");
    rows.push({ date: v.date, part, no: v.no, dr, cr });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date) || a.no.localeCompare(b.no));
  return rows;
}

/** Total line amount after discount (before tax). */
export function lineNet(l: VLine): number {
  if (l._net != null) return l._net;
  return Math.round(l.qty * l.rate * (1 - (l.disc || 0) / 100) * 100) / 100;
}

/** Line tax (after discount). */
export function lineTax(l: VLine, isGst: boolean): number {
  if (l._tax != null) return l._tax;
  if (!isGst) return 0;
  return Math.round(lineNet(l) * l.gst / 100 * 100) / 100;
}

/** Amount in words (Indian system) — "Rupees X Only" documents. */
export function amtWords(n: number): string {
  n = Math.round(Math.abs(n));
  if (!n) return "Zero";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number) => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? " " + a[x % 10] : "");
  const three = (x: number) => Math.floor(x / 100)
    ? a[Math.floor(x / 100)] + " Hundred" + (x % 100 ? " " + two(x % 100) : "") : two(x);
  let s = "";
  let cr = Math.floor(n / 1e7); n %= 1e7;
  const lk = Math.floor(n / 1e5); n %= 1e5;
  const th = Math.floor(n / 1e3); n %= 1e3;
  if (cr) s += three(cr) + " Crore ";
  if (lk) s += three(lk) + " Lakh ";
  if (th) s += three(th) + " Thousand ";
  if (n) s += three(n);
  return s.trim();
}