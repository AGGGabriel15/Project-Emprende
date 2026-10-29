import { ArrowLeft, MapPin, MessageCircle, Navigation, Phone, Star, Store, User } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CourierPanel } from "@/components/courier/courier-panel";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { courierStage, SHIPMENT_STATUS } from "@/features/couriers/status";
import { signEvidence } from "@/features/logistics/evidence";
import { requireCourier } from "@/lib/auth";
import { mapsSearchUrl, mapsUrl } from "@/lib/maps";
import { formatPhone, phoneHref, whatsappHref } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { Shipment } from "@/types/domain";

export const metadata: Metadata = { title: "Entrega" };

type Params = Promise<{ id: string }>;

type DeliveryView = {
  shipment: Shipment;
  active: boolean;
  order: {
    id: string;
    order_number: string;
    status: string;
    ready_photo_path: string | null;
    municipality: string | null;
    department: string | null;
    items: { name: string; quantity: number; image: string | null }[];
  };
  customer: { name: string; phone?: string; address_line?: string; note?: string | null };
  business: {
    trade_name: string;
    phone: string | null;
    whatsapp: string | null;
    address_line: string | null;
    municipality: string | null;
    latitude: number | null;
    longitude: number | null;
  };
  rating: { rating: number; tags: string[]; comment: string | null } | null;
};

/** Una entrega, paso a paso. Los datos del cliente solo se reciben mientras está activa. */
export default async function DeliveryPage({ params }: { params: Params }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireCourier(`/repartidor/entrega/${id}`);
  const supabase = await createClient();
  const { data } = await supabase.rpc("courier_delivery", { p_shipment: id });
  const view = data as DeliveryView | null;
  if (!view) notFound();
  const { shipment, order, business, customer } = view;
  const evidence = view.active ? await signEvidence([order.ready_photo_path]) : {};
  const stage = courierStage(shipment.status);
  const [label, tone] = SHIPMENT_STATUS[shipment.status];
  const toBusiness = stage === "to_pickup" || stage === "at_pickup";
  const toCustomer = stage === "to_dropoff" || stage === "at_dropoff";
  const fullAddress = [customer.address_line, order.municipality, order.department].filter(Boolean).join(", ");
  const greeting = `Hola ${customer.name.split(" ")[0]}, soy ${shipment.courier_name?.split(" ")[0]}, tu repartidor de Catarina Market (pedido ${order.order_number}).`;

  return (
    <div className="space-y-4 pb-8">
      <RealtimeRefresh channel={`delivery:${shipment.id}`} table="shipments" filter={`id=eq.${shipment.id}`} />
      <Link href="/repartidor" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Mis entregas
      </Link>
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {order.order_number} <Badge tone={tone}>{label}</Badge>
        </h1>
        {shipment.attempts > 0 && (
          <p className="text-sm text-destructive">{shipment.attempts} intento(s) de entrega fallido(s)</p>
        )}
      </div>

      <Card className={cn("space-y-2 p-4 text-sm", toBusiness && "ring-2 ring-primary")}>
        <p className="flex items-center gap-2 font-semibold">
          <Store className="size-4 text-primary" /> 1 · Recoger en {business.trade_name}
        </p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {business.address_line}
          {business.municipality ? `, ${business.municipality}` : ""}
        </p>
        {view.active && (
          <div className="flex flex-wrap gap-2 pt-1">
            {business.phone && (
              <ContactLink href={phoneHref(business.phone)} icon={<Phone />} label={`Llamar · ${formatPhone(business.phone)}`} />
            )}
            {business.whatsapp && <ContactLink href={whatsappHref(business.whatsapp)} icon={<MessageCircle />} label="WhatsApp" external />}
            <ContactLink
              href={
                business.latitude != null && business.longitude != null
                  ? mapsUrl(business.latitude, business.longitude)
                  : mapsSearchUrl(`${business.address_line ?? business.trade_name}, ${business.municipality ?? ""}, Nicaragua`)
              }
              icon={<Navigation />}
              label="Cómo llegar"
              external
            />
          </div>
        )}
      </Card>

      <Card className="p-4 text-sm">
        <p className="mb-2 font-semibold">Qué debes recibir</p>
        <ul className="space-y-1">
          {order.items.map((item) => (
            <li key={item.name}>
              <strong>{item.quantity}×</strong> {item.name}
            </li>
          ))}
        </ul>
        {evidence[order.ready_photo_path ?? ""] && (
          <figure className="mt-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={evidence[order.ready_photo_path!]} alt="Pedido empacado por el negocio" className="aspect-video w-full rounded-xl object-cover" />
            <figcaption className="mt-1 text-xs text-muted-foreground">Foto del negocio al empacar: compárala al recoger.</figcaption>
          </figure>
        )}
      </Card>

      <Card className={cn("space-y-2 p-4 text-sm", toCustomer && "ring-2 ring-primary")}>
        <p className="flex items-center gap-2 font-semibold">
          <User className="size-4 text-primary" /> 2 · Entregar a {customer.name}
        </p>
        <p className="flex items-start gap-2 text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" />
          {view.active ? fullAddress : `${order.municipality ?? ""}, ${order.department ?? ""}`}
        </p>
        {customer.note && <p className="rounded-lg bg-warning-soft px-3 py-2">Nota del cliente: {customer.note}</p>}
        {view.active && customer.phone && (
          <div className="flex flex-wrap gap-2 pt-1">
            <ContactLink href={phoneHref(customer.phone)} icon={<Phone />} label={`Llamar · ${formatPhone(customer.phone)}`} />
            <ContactLink href={whatsappHref(customer.phone, greeting)} icon={<MessageCircle />} label="WhatsApp" external />
            <ContactLink href={mapsSearchUrl(`${fullAddress}, Nicaragua`)} icon={<Navigation />} label="Cómo llegar" external />
          </div>
        )}
        {!view.active && <p className="text-xs text-muted-foreground">Los datos de contacto se ocultan al terminar la entrega.</p>}
      </Card>

      {view.rating && (
        <Card className="space-y-1 p-4 text-sm">
          <p className="flex items-center gap-1 font-semibold">
            <Star className="size-4 fill-warning text-warning" /> El cliente te calificó con {view.rating.rating} de 5
          </p>
          {view.rating.tags.length > 0 && <p className="text-muted-foreground">{view.rating.tags.join(" · ")}</p>}
          {view.rating.comment && <p>“{view.rating.comment}”</p>}
        </Card>
      )}

      <CourierPanel shipmentId={shipment.id} stage={stage} />
      {stage === "at_dropoff" && (
        <p className="text-center text-xs text-muted-foreground">
          El cliente ve su PIN en su pedido. Pídeselo después de que revise el paquete.
        </p>
      )}
    </div>
  );
}

function ContactLink({ href, icon, label, external }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-medium text-primary hover:border-primary [&_svg]:size-4"
    >
      {icon} {label}
    </a>
  );
}
