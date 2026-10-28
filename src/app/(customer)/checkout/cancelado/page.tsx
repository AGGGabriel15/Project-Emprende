import { CircleSlash } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResumePaymentButton } from "@/components/orders/resume-payment-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOrderDetail } from "@/features/orders/queries";
import { requireCustomer } from "@/lib/auth";

export const metadata: Metadata = { title: "Pago no completado" };

type SearchParams = Promise<{ pedido?: string }>;

export default async function CancelledPage({ searchParams }: { searchParams: SearchParams }) {
  const { pedido } = await searchParams;
  await requireCustomer("/pedidos");
  const order = pedido ? await getOrderDetail(pedido) : null;

  return (
    <div className="container-page max-w-lg py-12">
      <Card className="p-8 text-center">
        <CircleSlash className="mx-auto size-14 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-semibold">No se completó el pago</h1>
        <p className="mt-2 text-muted-foreground">
          Tu pedido quedó en <strong>Pendientes</strong> por 30 minutos. Puedes reintentar el pago
          antes de que venza.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {order?.status === "pending_payment" && <ResumePaymentButton orderId={order.id} />}
          <Button asChild variant="outline">
            <Link href="/pedidos?tab=pendientes">Ver pendientes</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
