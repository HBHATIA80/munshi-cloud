import { getSession } from "@/lib/auth";
import { CartView } from "@/sections/store/CartFlow";

export default async function CartPage() {
  const s = await getSession();
  return <><h2 style={{ marginBottom: 14 }}>Your cart</h2>
    <CartView trade={s?.trade ?? false} /></>;
}