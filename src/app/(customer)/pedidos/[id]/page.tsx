import { ArrowLeft, MapPin, MessageCircle, Phone, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductImage } from "@/components/catalog/product-image";
import { Stars } from "@/components/catalog/rating";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ResumePaymentButton } from "@/components/orders/resume-payment-button";
import { ReviewForm } from "@/components/orders/review-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getOrderDetail } from "@/features/orders/queries";
import { SERVICE_LABEL } from "@/features/orders/status";
import { requireCustomer } from "@/lib/auth";
import { formatDate, formatMoney } from "@/lib/utils";
import { formatPhone, phoneHref, whatsappHref } from "@/lib/phone";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = { title: "Detalle del pedido" };

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { profile } = await requireCustomer(`/pedidos/${id}`);
  const order = await getOrderDetail(id);
  if (!order || order.customer_id !== profile.id) notFound();
  const address = order.address_snapshot;

  return (
    <div className="container-page max-w-5xl py-8">
      <RealtimeRefresh channel={`order:${order.id}`} table="orders" filter={`id=eq.${order.id}`} />
      <Link href="/pedidos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> Mis pedidos
      </Link>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">Pedido {order.order_number}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(order.created_at)} · {SERVICE_LABEL[order.service_type]}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === "pending_payment" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning-soft p-4 text-sm">
          <span>Falta confirmar el pago. El pedido vence {order.expires_at ? formatDate(order.expires_at) : "pronto"}.</span>
          <ResumePaymentButton orderId={order.id} size="sm" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Seguimiento" description="Se actualiza en vivo." />
            <CardBody>
              <OrderTimeline status={order.status} service={order.service_type} history={order.history} />
              {order.refunds.length > 0 && (
                <div className="mt-5 rounded-xl bg-muted p-3 text-sm">
                  Reembolso de {formatMoney(order.refunds[0].amount_minor)} procesado el {formatDate(order.refunds[0].created_at)}.
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Productos" />
            <ul className="divide-y">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center gap-4 px-5 py-3 sm:px-6">
                  <ProductImage src={item.image_url} alt="" className="size-14 shrink-0 rounded-xl" sizes="56px" />
                  <div className="min-w-0 flex-1 text-sm">
                    {item.product_id ? (
                      <Link href={`/productos/${item.product_id}`} className="font-medium hover:text-primary">{item.product_name}</Link>
                    ) : (
                      <p className="font-medium">{item.product_name}</p>
                    )}
                    <p className="text-muted-foreground">
                      {item.quantity} × {formatMoney(item.unit_price_minor)}
                    </p>
                    {item.note && <p className="text-xs text-muted-foreground">Nota: {item.note}</p>}
                  </div>
                  <p className="font-medium tabular-nums">{formatMoney(item.subtotal_minor)}</p>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t px-5 py-4 text-sm sm:px-6">
              <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd>{formatMoney(order.subtotal_minor)}</dd></div>
              {order.service_type === "delivery" && (
                <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd>{formatMoney(order.delivery_fee_minor)}</dd></div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(order.total_minor)}</dd></div>
            </dl>
          </Card>

          {order.status === "completed" && (
            <Card>
              <CardHeader title="Tu reseña" />
              <CardBody>
                {order.review ? (
                  <div>
                    <Stars value={order.review.rating} />
                    {order.review.comment && <p className="mt-2 text-sm">{order.review.comment}</p>}
                  </div>
                ) : (
                  <ReviewForm orderId={order.id} businessName={order.business.trade_name} />
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5 text-sm">
            <Link href={`/negocios/${order.business.slug}`} className="flex items-center gap-2 font-semibold hover:text-primary">
              <Store className="size-4 text-primary" /> {order.business.trade_name}
            </Link>
            <div className="mt-3 space-y-2 text-muted-foreground">
              {order.business.phone && (
                <a href={phoneHref(order.business.phone)} className="flex items-center gap-2 hover:text-primary">
                  <Phone className="size-4" /> {formatPhone(order.business.phone)}
                </a>
              )}
              {order.business.whatsapp && (
                <a href={whatsappHref(order.business.whatsapp, `Hola, consulto por mi pedido ${order.order_number}`)} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary">
                  <MessageCircle className="size-4" /> WhatsApp
                </a>
              )}
            </div>
          </Card>
          <Card className="p-5 text-sm">
            <p className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 text-primary" />
              {order.service_type === "delivery" ? "Entrega" : "Retiro en el local"}
            </p>
            {address ? (
              <div className="mt-2 text-muted-foreground">
                <p>{address.address_line}</p>
                <p>{address.municipality}, {address.department}</p>
                <p className="mt-1">Recibe {address.recipient_name} · {formatPhone(address.phone)}</p>
                {order.estimated_days !== null && (
                  <p className="mt-2 text-foreground">
                    Tiempo estimado: {order.estimated_days === 0 ? "el mismo día" : `${order.estimated_days} ${order.estimated_days === 1 ? "día" : "días"}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-muted-foreground">{order.business.address_line ?? "Coordina con el negocio."}</p>
            )}
            <p className="mt-3 border-t pt-3 text-muted-foreground">
              Contacto: {order.contact_name} · {formatPhone(order.contact_phone)}
            </p>
            {order.customer_note && <p className="mt-2 text-muted-foreground">Nota: {order.customer_note}</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
