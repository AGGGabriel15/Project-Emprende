import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DemoPayment } from "@/components/customer/demo-payment";
import { getOrderDetail } from "@/features/orders/queries";
import { requireCustomer } from "@/lib/auth";

export const metadata: Metadata = { title: "Pago de demostración" };

type Params = Promise<{ orderId: string }>;

export default async function DemoPaymentPage({ params }: { params: Params }) {
  const { orderId } = await params;
  await requireCustomer(`/checkout/pago-demo/${orderId}`);
  const order = await getOrderDetail(orderId);
  if (!order) notFound();
  if (order.status !== "pending_payment") redirect(`/pedidos/${order.id}`);
  return (
    <div className="container-page max-w-lg py-10">
      <DemoPayment
        orderId={order.id}
        orderNumber={order.order_number}
        businessName={order.business.trade_name}
        totalMinor={order.total_minor}
      />
    </div>
  );
}
