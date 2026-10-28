"use client";

import { CreditCard, FlaskConical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { completeMockPayment } from "@/features/checkout/actions";
import { formatMoney } from "@/lib/utils";

/** Simula una pasarela externa (modo sin llaves de Stripe). */
export function DemoPayment({
  orderId,
  orderNumber,
  businessName,
  totalMinor,
}: {
  orderId: string;
  orderNumber: string;
  businessName: string;
  totalMinor: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function pay() {
    startTransition(async () => {
      const result = await completeMockPayment(orderId);
      if (!result.ok) return void toast.error(result.error);
      router.replace(`/checkout/exito?pedido=${orderId}`);
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 bg-warning-soft px-5 py-3 text-sm font-medium">
        <FlaskConical className="size-4 text-warning" />
        Pasarela de demostración · no se cobra dinero real
      </div>
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Pedido {orderNumber} · {businessName}
        </p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{formatMoney(totalMinor)}</p>
        <div className="mt-6 space-y-4">
          <Field label="Número de tarjeta" htmlFor="card">
            <Input id="card" defaultValue="4242 4242 4242 4242" readOnly />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Vence" htmlFor="exp">
              <Input id="exp" defaultValue="12/30" readOnly />
            </Field>
            <Field label="CVC" htmlFor="cvc">
              <Input id="cvc" defaultValue="123" readOnly />
            </Field>
          </div>
        </div>
        <Button size="lg" className="mt-6 w-full" onClick={pay} loading={pending}>
          <CreditCard /> Pagar {formatMoney(totalMinor)}
        </Button>
        <Button asChild variant="ghost" className="mt-2 w-full">
          <Link href={`/checkout/cancelado?pedido=${orderId}`}>Cancelar</Link>
        </Button>
      </div>
    </Card>
  );
}
