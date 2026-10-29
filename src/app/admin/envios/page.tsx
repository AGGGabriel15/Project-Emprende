import { CheckCheck, PackageOpen, Truck } from "lucide-react";
import type { Metadata } from "next";
import { PromptActionButton } from "@/components/admin/action-buttons";
import { AssignCourierForm, type CourierOption } from "@/components/admin/courier-forms";
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { confirmDeliveryWithoutPin } from "@/features/admin/actions";
import { ACTIVE_SHIPMENT, SHIPMENT_STATUS } from "@/features/couriers/status";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/utils";
import type { AddressSnapshot, ShipmentStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Envíos" };

type ShipmentRow = {
  id: string;
  status: ShipmentStatus;
  courier_id: string | null;
  courier_name: string | null;
  attempts: number;
  failure_notes: string | null;
  created_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  order: {
    id: string;
    order_number: string;
    delivery_fee_minor: number;
    address_snapshot: AddressSnapshot | null;
    business: { trade_name: string } | null;
  } | null;
};

const SELECT =
  "id, status, courier_id, courier_name, attempts, failure_notes, created_at, accepted_at, picked_up_at, order:orders(id, order_number, delivery_fee_minor, address_snapshot, business:businesses(trade_name))";

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

export default async function ShipmentsPage() {
  const supabase = await createClient();
  const [{ data: waiting }, { data: active }, { data: issues }, { data: couriers }] = await Promise.all([
    supabase.from("shipments").select(SELECT).eq("status", "available").order("created_at"),
    supabase.from("shipments").select(SELECT).in("status", ACTIVE_SHIPMENT).order("created_at"),
    supabase
      .from("shipments")
      .select(SELECT)
      .or("status.in.(rejected,returned),attempts.gt.0")
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase.from("couriers").select("profile_id, is_online, profile:profiles(full_name)").eq("is_active", true),
  ]);
  const activeRows = (active ?? []) as unknown as ShipmentRow[];
  const load = new Map<string, number>();
  for (const row of activeRows) if (row.courier_id) load.set(row.courier_id, (load.get(row.courier_id) ?? 0) + 1);
  const options: CourierOption[] = (couriers ?? [])
    .map((c) => ({
      id: c.profile_id,
      name: (c.profile as unknown as { full_name: string } | null)?.full_name ?? "Repartidor",
      online: c.is_online,
      active: load.get(c.profile_id) ?? 0,
    }))
    .sort((a, b) => Number(b.online) - Number(a.online) || a.active - b.active);
  const waitingRows = (waiting ?? []) as unknown as ShipmentRow[];

  return (
    <>
      <PageHeader
        title="Envíos"
        description="Los pedidos empacados quedan disponibles para los repartidores en turno. Asigna a mano los que nadie toma."
      />
      <RealtimeRefresh channel="admin-shipments" table="shipments" />

      <Card className="mb-6">
        <CardHeader title={`Esperando repartidor (${waitingRows.length})`} description="● en turno · ○ fuera de turno" />
        {waitingRows.length === 0 ? (
          <EmptyState icon={<PackageOpen />} title="Todos los pedidos listos tienen repartidor" className="border-0" />
        ) : (
          <ul className="divide-y">
            {waitingRows.map((row) => {
              const minutes = minutesSince(row.created_at);
              return (
                <li key={row.id} data-shipment={row.order?.order_number} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {row.order?.order_number} · {row.order?.business?.trade_name}
                      <Badge tone={minutes >= 15 ? "red" : "amber"}>{minutes} min esperando</Badge>
                    </p>
                    <p className="text-muted-foreground">
                      A {row.order?.address_snapshot?.municipality}, {row.order?.address_snapshot?.department} · envío cobrado{" "}
                      {formatMoney(row.order?.delivery_fee_minor ?? 0)}
                    </p>
                  </div>
                  <AssignCourierForm orderId={row.order!.id} couriers={options} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ShipmentList title={`En curso (${activeRows.length})`} rows={activeRows} couriers={options} manage />
      {(issues ?? []).length > 0 && (
        <div className="mt-6">
          <ShipmentList title="Incidencias recientes" rows={(issues ?? []) as unknown as ShipmentRow[]} couriers={options} />
        </div>
      )}
    </>
  );
}

function ShipmentList({
  title,
  rows,
  couriers,
  manage = false,
}: {
  title: string;
  rows: ShipmentRow[];
  couriers: CourierOption[];
  manage?: boolean;
}) {
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <EmptyState icon={<Truck />} title="Sin envíos" className="border-0" />
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const [label, tone] = SHIPMENT_STATUS[row.status];
            const beforePickup = row.status === "assigned" || row.status === "at_pickup";
            const enRoute = row.status === "picked_up" || row.status === "at_dropoff";
            return (
              <li key={row.id} data-shipment={row.order?.order_number} className="flex flex-wrap items-center gap-4 px-5 py-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {row.order?.order_number} · {row.order?.business?.trade_name}
                    <Badge tone={tone}>{label}</Badge>
                  </p>
                  <p className="text-muted-foreground">
                    {row.courier_name ?? "Sin repartidor"} · a {row.order?.address_snapshot?.municipality}
                    {row.accepted_at && ` · aceptado ${formatDate(row.accepted_at)}`}
                    {row.attempts > 0 && ` · ${row.attempts} intento(s) fallido(s)`}
                  </p>
                  {row.failure_notes && <p className="mt-1 text-xs whitespace-pre-line text-destructive">{row.failure_notes}</p>}
                </div>
                {manage && beforePickup && <AssignCourierForm orderId={row.order!.id} couriers={couriers} current={row.courier_id} />}
                {manage && enRoute && (
                  <PromptActionButton
                    size="sm"
                    variant="outline"
                    title="Confirmar entrega sin PIN"
                    description="Solo si confirmaste la entrega con el cliente por otra vía (llamada, foto del repartidor). Queda en la auditoría."
                    label="Motivo"
                    minLength={10}
                    confirmLabel="Confirmar entrega"
                    success="Entrega confirmada."
                    action={async (reason: string) => {
                      "use server";
                      return confirmDeliveryWithoutPin(row.order!.id, reason);
                    }}
                  >
                    <CheckCheck /> Sin PIN
                  </PromptActionButton>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
