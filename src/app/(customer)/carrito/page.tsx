import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CartView } from "@/components/customer/cart-view";
import { getSession } from "@/lib/auth";
import { canShop, ROLE_HOME } from "@/lib/roles";

export const metadata: Metadata = { title: "Carrito" };

export default async function CartPage() {
  const session = await getSession();
  if (session && !canShop(session.profile.role)) redirect(ROLE_HOME[session.profile.role]);
  return (
    <div className="container-page py-8">
      <CartView />
    </div>
  );
}
