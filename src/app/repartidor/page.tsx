import { ChevronRight, PackageSearch, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AcceptButton, OnlineToggle } from "@/components/courier/shift-controls";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { SHIPMENT_STATUS } from "@/features/couriers/status";
import { requireCourier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Courier, ShipmentStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Entregas" };

type Available = {
  id: string;
  order_number: string;
  ready_at: string;
  business: string;
  business_address: string | null;
  business_municipality: string | null;
  municipality: string | null;
  department: string | null;
  items: number;
};

type ActiveDelivery = {
  id: string;
  status: ShipmentStatus;
  order_number: string;
  business: string;
  municipality: string | null;
  customer: string | null;
  attempts: number;
};

export default async function CourierHome() {
  const { profile } = await requireCourier("/repartidor");
  const supabase = await createClient();
  const [{ data: courier }, { data: active }, { data: available }] = await Promise.all([
    supabase.from("couriers").select("*").eq("profile_id", profile.id).single<Courier>(),
    supabase.rpc("courier_deliveries", { p_scope: "active" }),
    supabase.rpc("available_shipments"),
  ]);
  const mine = (active ?? []) as ActiveDelivery[];
  const open = (available ?? []) as Available[];
  const online = Boolean(courier?.is_online);

  return (
    <>
      <PageHeader title={`Hola, ${profile.full_name.split(" ")[0] || "repartidor"}`} description="Tus entregas y los pedidos listos para recoger." />
      {/* Se actualiza solo cuando un negocio marca listo o alguien toma un pedido. */}
      <RealtimeRefresh channel={`courier:${profile.id}`} table="shipments" />

      <OnlineToggle online={online} />

      <Card className="mt-6">
        <CardHeader title={`Mis entregas activas (${mine.length})`} />
        {mine.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-muted-foreground">No tienes entregas en curso.</p>
        ) : (
          <ul className="divide-y">
            {mine.map((delivery) => {
              const [label, tone] = SHIPMENT_STATUS[delivery.status];
              return (
                <li key={delivery.id}>
                  <Link href={`/repartidor/entrega/${delivery.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-muted/50">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {delivery.order_number} <Badge tone={tone}>{label}</Badge>
                      </p>
                      <p className="truncate text-muted-foreground">
                        {delivery.business} → {delivery.customer} · {delivery.municipality}
                        {delivery.attempts > 0 && ` · ${delivery.attempts} intento(s) fallido(s)`}
                      </p>
                    </div>
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader title={`Disponibles (${online ? open.length : 0})`} description="El primero que acepta se lo lleva." />
        {!online ? (
          <EmptyState icon={<PackageSearch />} title="Ponte en turno para ver pedidos" className="border-0" />
        ) : open.length === 0 ? (
          <EmptyState icon={<PackageSearch />} title="No hay pedidos esperando" description="Te avisaremos cuando un negocio marque uno como listo." className="border-0" />
        ) : (
          <ul className="divide-y">
            {open.map((item) => (
              <li key={item.id} data-available={item.order_number} className="flex flex-wrap items-center gap-3 px-5 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <Store className="size-4 text-primary" /> {item.business}
                  </p>
                  <p className="text-muted-foreground">
                    Recoger en {item.business_municipality ?? item.business_address} → entregar en {item.municipality}, {item.department}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.items} {item.items === 1 ? "producto" : "productos"} · listo {formatDate(item.ready_at)}
                  </p>
                </div>
                <AcceptButton shipmentId={item.id} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
