import { Suspense } from "react";
import { DemoPayment } from "@/components/checkout/demo-payment";

export default function DemoPaymentPage() {
  return (
    <div className="container-page grid min-h-[680px] place-items-center py-12">
      <div className="w-full max-w-lg">
        <Suspense fallback={<p>Cargando pago…</p>}>
          <DemoPayment />
        </Suspense>
      </div>
    </div>
  );
}
