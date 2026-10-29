import type { Metadata } from "next";
import { OrdersBoard } from "@/components/vendor/orders-board";
import { PageHeader } from "@/components/ui/card";
import { requireApprovedBusiness } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { BoardOrder } from "@/features/orders/queries";

export const metadata: Metadata = { title: "Pedidos" };

export default async function VendorOrdersPage() {
  const { business } = await requireApprovedBusiness("/vendedor/pedidos");
  const supabase = await createClient();
  const since = daysAgo(7);
  const [{ data: active }, { data: recent }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, items:order_items(*), shipment:shipments(status, courier_name)")
      .eq("business_id", business.id)
      .in("status", ["preparing", "ready", "ready_for_pickup", "on_the_way"])
      .order("paid_at", { ascending: true }),
    supabase
      .from("orders")
      .select("*, items:order_items(*), shipment:shipments(status, courier_name)")
      .eq("business_id", business.id)
      .in("status", ["delivered", "disputed", "completed", "cancelled", "refunded", "returned"])
      .not("paid_at", "is", null)
      .gte("updated_at", since)
      .order("updated_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <>
      <PageHeader
        title="Pedidos"
        description="Empaca, toma la foto y marca listo: Catarina Market lo recoge y lo entrega. El pago se libera 48 h después de la entrega."
      />
      <OrdersBoard
        businessId={business.id}
        active={(active ?? []) as BoardOrder[]}
        recent={(recent ?? []) as BoardOrder[]}
        readOnly={business.status !== "approved"}
      />
    </>
  );
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 86_400_000).toISOString();
}
