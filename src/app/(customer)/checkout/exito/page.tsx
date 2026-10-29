import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ClearOrderedItems } from "@/components/customer/clear-ordered-items";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOrderDetail } from "@/features/orders/queries";
import { syncStripePayment } from "@/features/payments/sync";
import { requireCustomer } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Pedido recibido" };

type SearchParams = Promise<{ pedido?: string }>;

/**
 * Muestra el estado del pago. Si el webhook aún no llegó, consulta la sesión a
 * Stripe (servidor a servidor) y acredita el pedido; Realtime refresca después.
 */
export default async function SuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const { pedido } = await searchParams;
  const { profile } = await requireCustomer("/pedidos");
  const order = pedido ? await getOrderDetail(pedido) : null;
  if (!order || order.customer_id !== profile.id) notFound();
  // Next memoiza la consulta dentro del render: tras acreditar se recarga la ruta.
  if (order.status === "pending_payment" && (await syncStripePayment(order.id))) {
    redirect(`/checkout/exito?pedido=${order.id}`);
  }

  const confirmed = order.payment_status === "paid" || order.payment_status === "refunded";
  const failed = order.status === "cancelled" || order.status === "refunded";

  return (
    <div className="container-page max-w-lg py-12">
      <RealtimeRefresh channel={`order-success:${order.id}`} table="orders" filter={`id=eq.${order.id}`} />
      {confirmed && (
        <ClearOrderedItems productIds={order.items.map((item) => item.product_id).filter((id): id is string => Boolean(id))} />
      )}
      <Card className="p-8 text-center">
        {failed ? (
          <XCircle className="mx-auto size-14 text-destructive" />
        ) : confirmed ? (
          <CheckCircle2 className="mx-auto size-14 text-success" />
        ) : (
          <Clock className="mx-auto size-14 animate-pulse text-warning" />
        )}
        <h1 className="mt-4 text-2xl font-semibold">
          {failed ? "No pudimos completar el pedido" : confirmed ? "¡Pago confirmado!" : "Confirmando tu pago…"}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {failed
            ? order.cancel_reason ?? "El pedido fue cancelado."
            : confirmed
              ? `${order.business.trade_name} ya está preparando tu pedido ${order.order_number}.`
              : "Esperamos la confirmación de la pasarela. Esta página se actualiza sola."}
        </p>
        <p className="mt-4 text-2xl font-semibold tabular-nums">{formatMoney(order.total_minor)}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link href={`/pedidos/${order.id}`}>Seguir mi pedido</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/carrito">Volver al carrito</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
