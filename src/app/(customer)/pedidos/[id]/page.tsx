import { ArrowLeft, Bike, KeyRound, MapPin, MessageCircle, Phone, ShieldCheck, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProductImage } from "@/components/catalog/product-image";
import { Stars } from "@/components/catalog/rating";
import { Avatar } from "@/components/layout/account-menu";
import { ClaimForm } from "@/components/orders/claim-form";
import { DeliveryRatingForm } from "@/components/orders/delivery-rating-form";
import { EvidenceGallery } from "@/components/orders/evidence-gallery";
import { OrderStatusBadge } from "@/components/orders/order-status-badge";
import { OrderTimeline } from "@/components/orders/order-timeline";
import { ResumePaymentButton } from "@/components/orders/resume-payment-button";
import { ReviewForm } from "@/components/orders/review-form";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CUSTOMER_COURIER_STEP, VEHICLE_LABEL } from "@/features/couriers/status";
import { getOrderDetail } from "@/features/orders/queries";
import { CLAIM_REASONS, SERVICE_LABEL, showsPin } from "@/features/orders/status";
import { signEvidence } from "@/features/logistics/evidence";
import { createClient } from "@/lib/supabase/server";
import { requireCustomer } from "@/lib/auth";
import { cn, formatDate, formatMoney } from "@/lib/utils";
import { formatPhone, phoneHref, whatsappHref } from "@/lib/phone";
import { syncStripePayment } from "@/features/payments/sync";
import type { OrderCourier } from "@/types/domain";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = { title: "Detalle del pedido" };

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { profile } = await requireCustomer(`/pedidos/${id}`);
  const order = await getOrderDetail(id);
  if (!order || order.customer_id !== profile.id) notFound();
  // Next memoiza la consulta dentro del render: tras acreditar se recarga la ruta.
  if (order.status === "pending_payment" && (await syncStripePayment(order.id))) redirect(`/pedidos/${id}`);
  const address = order.address_snapshot;

  const supabase = await createClient();
  const delivery = order.service_type === "delivery";
  const [{ data: secret }, { data: windowSetting }, { data: courierData }, { data: deliveryRating }] = await Promise.all([
    showsPin(order.status)
      ? supabase.from("order_secrets").select("pin").eq("order_id", order.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("platform_settings").select("value").eq("key", "claim_window_hours").maybeSingle(),
    delivery ? supabase.rpc("order_courier", { p_order: order.id }) : Promise.resolve({ data: null }),
    delivery
      ? supabase.from("delivery_ratings").select("rating, tags, comment").eq("order_id", order.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const courier = courierData as OrderCourier | null;
  const courierArrived = courier?.status === "at_dropoff";
  const canRateCourier =
    courier?.status === "delivered" && !deliveryRating && ["delivered", "disputed", "completed"].includes(order.status);
  const claimHours = Number(windowSetting?.value ?? 48);
  const claimDeadline = order.delivered_at ? new Date(new Date(order.delivered_at).getTime() + claimHours * 3_600_000) : null;
  const canClaim = order.status === "delivered" && claimDeadline !== null && isFuture(claimDeadline) && !order.claims.some((c) => c.status === "open");
  const evidence = await signEvidence([
    order.ready_photo_path,
    order.shipment?.pickup_photo_path,
    order.shipment?.delivery_photo_path,
    ...order.claims.flatMap((c) => c.photo_paths),
  ]);

  return (
    <div className="container-page max-w-5xl py-8">
      <RealtimeRefresh channel={`order:${order.id}`} table="orders" filter={`id=eq.${order.id}`} />
      {delivery && <RealtimeRefresh channel={`order-shipment:${order.id}`} table="shipments" filter={`order_id=eq.${order.id}`} />}
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

      {secret?.pin && (
        <div
          className={cn(
            "mb-6 flex flex-wrap items-center gap-4 rounded-2xl border-2 border-primary/30 bg-primary-soft p-4",
            courierArrived && "border-primary ring-4 ring-primary/20",
          )}
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound className="size-5" />
          </span>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">{courierArrived ? "¡Tu repartidor llegó! Este es tu PIN" : "Tu PIN de entrega"}</p>
            <p className="text-muted-foreground">
              {order.service_type === "delivery"
                ? "Dáselo al repartidor solo cuando tengas el pedido en tus manos y lo hayas revisado."
                : "Dáselo en el negocio solo cuando te entreguen el pedido y lo hayas revisado."}
            </p>
          </div>
          <p className="font-display text-4xl font-semibold tracking-[0.3em] text-primary tabular-nums">{secret.pin}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Seguimiento" description="Se actualiza en vivo." />
            <CardBody>
              <OrderTimeline status={order.status} service={order.service_type} history={order.history} />
              {order.refunds.map((refund) => (
                <div key={refund.created_at} className="mt-3 rounded-xl bg-muted p-3 text-sm">
                  Reembolso de <strong>{formatMoney(refund.amount_minor)}</strong>:{" "}
                  {refund.status === "processed"
                    ? `procesado el ${formatDate(refund.processed_at ?? refund.created_at)}`
                    : "en proceso (puede tardar unos días en reflejarse en tu tarjeta)"}
                  <span className="block text-xs text-muted-foreground">{refund.reason}</span>
                </div>
              ))}
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
              {order.service_fee_minor > 0 && (
                <div className="flex justify-between"><dt className="text-muted-foreground">Tarifa de servicio</dt><dd>{formatMoney(order.service_fee_minor)}</dd></div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold"><dt>Total</dt><dd>{formatMoney(order.total_minor)}</dd></div>
            </dl>
          </Card>

          {Object.keys(evidence).length > 0 && (
            <Card>
              <CardHeader title="Evidencia del pedido" description="Fotos tomadas en cada paso. Se usan para resolver cualquier reclamo." />
              <CardBody>
                <EvidenceGallery
                  items={[
                    { label: "Empacado por el negocio", url: evidence[order.ready_photo_path ?? ""], at: order.ready_at },
                    { label: "Recogido por el repartidor", url: evidence[order.shipment?.pickup_photo_path ?? ""], at: order.shipment?.picked_up_at },
                    { label: "Entregado", url: evidence[order.shipment?.delivery_photo_path ?? ""], at: order.shipment?.delivered_at },
                  ]}
                />
              </CardBody>
            </Card>
          )}

          {(canClaim || order.claims.length > 0) && (
            <Card>
              <CardHeader title="¿Algún problema?" />
              <CardBody className="space-y-4 text-sm">
                {order.claims.map((claim) => (
                  <div key={claim.id} className="rounded-xl border p-4">
                    <p className="font-semibold">
                      {CLAIM_REASONS[claim.reason]} ·{" "}
                      {claim.status === "open" ? "En revisión" : claim.status === "approved" ? "Aprobado" : "Rechazado"}
                    </p>
                    <p className="mt-1 text-muted-foreground">{claim.description}</p>
                    {claim.resolution_note && <p className="mt-2">Respuesta: {claim.resolution_note}</p>}
                    {claim.refund_minor ? <p className="mt-1">Reembolso: {formatMoney(claim.refund_minor)}</p> : null}
                    <div className="mt-3">
                      <EvidenceGallery items={claim.photo_paths.map((path, i) => ({ label: `Tu foto ${i + 1}`, url: evidence[path] }))} />
                    </div>
                  </div>
                ))}
                {canClaim && claimDeadline && <ClaimForm orderId={order.id} deadline={formatDate(claimDeadline.toISOString())} />}
              </CardBody>
            </Card>
          )}

          {(canRateCourier || deliveryRating) && courier && (
            <Card>
              <CardHeader title="Tu repartidor" />
              <CardBody>
                {deliveryRating ? (
                  <div className="text-sm">
                    <Stars value={deliveryRating.rating} />
                    {deliveryRating.tags.length > 0 && <p className="mt-2 text-muted-foreground">{deliveryRating.tags.join(" · ")}</p>}
                    {deliveryRating.comment && <p className="mt-1">{deliveryRating.comment}</p>}
                  </div>
                ) : (
                  <DeliveryRatingForm orderId={order.id} courierName={courier.name} />
                )}
              </CardBody>
            </Card>
          )}

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
          {delivery && ["ready", "on_the_way"].includes(order.status) && (
            <Card className="p-5 text-sm" data-testid="courier-card">
              <p className="flex items-center gap-2 font-semibold">
                <Bike className="size-4 text-primary" /> Tu repartidor
              </p>
              {courier ? (
                <>
                  <div className="mt-3 flex items-center gap-3">
                    <Avatar name={courier.name} url={courier.avatar_url} className="size-12" />
                    <div className="min-w-0">
                      <p className="font-medium">{courier.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {courier.vehicle ? VEHICLE_LABEL[courier.vehicle] : ""}
                        {courier.plate && ` · ${courier.plate}`}
                        {courier.rating_count ? ` · ★ ${Number(courier.rating_avg).toFixed(1)}` : ""}
                      </p>
                    </div>
                  </div>
                  <p className={cn("mt-3 rounded-xl px-3 py-2", courierArrived ? "bg-primary text-primary-foreground" : "bg-muted")}>
                    {CUSTOMER_COURIER_STEP[courier.status]}
                  </p>
                  {courier.phone && (
                    <div className="mt-3 flex gap-3">
                      <a href={phoneHref(courier.phone)} className="inline-flex items-center gap-1 font-medium text-primary">
                        <Phone className="size-4" /> Llamar
                      </a>
                      <a
                        href={whatsappHref(courier.phone, `Hola, soy quien recibe el pedido ${order.order_number}.`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-medium text-primary"
                      >
                        <MessageCircle className="size-4" /> WhatsApp
                      </a>
                    </div>
                  )}
                </>
              ) : (
                <p className="mt-2 text-muted-foreground">{CUSTOMER_COURIER_STEP.available}</p>
              )}
            </Card>
          )}
          <Card className="flex gap-3 p-5 text-sm">
            <ShieldCheck className="size-5 shrink-0 text-primary" />
            <p className="text-muted-foreground">
              <strong className="block text-foreground">Pago protegido</strong>
              Retenemos tu pago y se lo liberamos al negocio {claimHours} h después de la entrega, si no reportas problemas.
            </p>
          </Card>
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

function isFuture(date: Date) {
  return date.getTime() > Date.now();
}
