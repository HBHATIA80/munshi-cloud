export type Plan = "trial" | "basic" | "pro";
export const CUSTOMER_CAPS: Record<Plan, number> = { trial: 15, basic: 100, pro: 1000 };
export const customerCap = (plan: string | null | undefined) =>
  CUSTOMER_CAPS[(plan as Plan) || "trial"] ?? 15;
/** Ledger access is a paid feature: trial/free plans cannot view party ledgers. */
export function ledgerAllowed(plan?: string | null): boolean {
  const p = (plan || "").toLowerCase();
  return p !== "trial" && p !== "free" && p !== "";
}