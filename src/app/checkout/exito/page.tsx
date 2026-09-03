import { CircleCheckBig } from "lucide-react";
import Link from "next/link";
import { PaymentSuccess } from "@/components/checkout/payment-success";
import { Button } from "@/components/ui/button";

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const { pedido } = await searchParams;
  return (
    <div className="container-page grid min-h-[680px] place-items-center py-12">
      <div className="max-w-xl rounded-[2rem] border bg-white p-10 text-center shadow-xl shadow-[#174936]/5">
        <PaymentSuccess />
        <CircleCheckBig className="mx-auto text-[#236b4e]" size={60} />
        <h1 className="mt-5 text-4xl font-bold">¡Pedido confirmado!</h1>
        <p className="mt-3 text-[#65736b]">
          Tu pago fue registrado. El emprendedor ya puede preparar tu compra.
        </p>
        {pedido && (
          <p className="mt-5 rounded-xl bg-[#f7f7f3] p-3 font-mono text-sm">
            {pedido}
          </p>
        )}
        <Button asChild className="mt-7">
          <Link href="/mis-pedidos">Ver mis pedidos</Link>
        </Button>
      </div>
    </div>
  );
}
