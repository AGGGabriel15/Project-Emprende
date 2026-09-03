import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { OrdersList } from "@/components/orders/orders-list";
import { authOptions } from "@/lib/auth";

export default async function MyOrdersPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=%2Fmis-pedidos");
  if (session.user.role !== "cliente") redirect("/");
  return (
    <div className="container-page py-12">
      <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
        Tu actividad
      </p>
      <h1 className="mt-2 mb-9 text-5xl font-bold">Mis pedidos</h1>
      <OrdersList />
    </div>
  );
}
