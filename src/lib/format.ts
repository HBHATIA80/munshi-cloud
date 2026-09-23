export const fmt = (n: number | null | undefined) => {
  const v = Number(n ?? 0);
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
export const fmt0 = (n: number | null | undefined) =>
  "₹" + Math.round(Number(n ?? 0)).toLocaleString("en-IN");
export const fq = (n: number) => (Number(n) % 1 ? Number(n).toFixed(2) : String(Math.round(Number(n))));
const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const dmy = (d: string) => d ? `${d.slice(8,10)} ${MON[+d.slice(5,7)-1]} ${d.slice(2,4)}` : "—";