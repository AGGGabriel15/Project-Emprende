import { AlertTriangle, Bike, Star } from "lucide-react";
import type { Metadata } from "next";
import { CourierActiveSwitch, CreateCourierButton } from "@/components/admin/courier-forms";
import { Avatar } from "@/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, EmptyState, PageHeader } from "@/components/ui/card";
import { ACTIVE_SHIPMENT, VEHICLE_LABEL } from "@/features/couriers/status";
import { formatPhone } from "@/lib/phone";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Courier } from "@/types/domain";

export const metadata: Metadata = { title: "Repartidores" };

type CourierRow = Courier & {
  profile: { full_name: string; email: string | null; phone: string | null; avatar_url: string | null } | null;
};

/** Promedio por debajo de este valor en las últimas 20 calificaciones genera alerta. */
const RATING_ALERT = 4;

export default async function CouriersPage() {
  const supabase = await createClient();
  const [{ data: couriers }, { data: shipments }, { data: ratings }] = await Promise.all([
    supabase
      .from("couriers")
      .select("*, profile:profiles(full_name, email, phone, avatar_url)")
      .order("is_active", { ascending: false })
      .order("created_at"),
    supabase.from("shipments").select("courier_id, status, attempts").not("courier_id", "is", null),
    supabase
      .from("delivery_ratings")
      .select("courier_id, rating, tags, comment, created_at, order:orders(order_number)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const rows = (couriers ?? []) as unknown as CourierRow[];

  const stats = new Map<string, { active: number; delivered: number; failed: number; rejected: number }>();
  for (const s of shipments ?? []) {
    const stat = stats.get(s.courier_id!) ?? { active: 0, delivered: 0, failed: 0, rejected: 0 };
    if ((ACTIVE_SHIPMENT as string[]).includes(s.status)) stat.active++;
    if (s.status === "delivered") stat.delivered++;
    if (s.status === "rejected") stat.rejected++;
    stat.failed += s.attempts;
    stats.set(s.courier_id!, stat);
  }
  const recent = new Map<string, number[]>();
  for (const r of ratings ?? []) {
    const list = recent.get(r.courier_id) ?? [];
    if (list.length < 20) list.push(r.rating);
    recent.set(r.courier_id, list);
  }
  const lowRatings = (ratings ?? []).filter((r) => r.rating <= 2).slice(0, 10);

  return (
    <>
      <PageHeader
        title="Repartidores"
        description="Empleados de Catarina Market que recogen y entregan los pedidos con delivery."
        action={<CreateCourierButton />}
      />

      {rows.length === 0 ? (
        <EmptyState icon={<Bike />} title="Aún no hay repartidores" description="Crea la cuenta de cada repartidor para que pueda aceptar pedidos." />
      ) : (
        <Card>
          <ul className="divide-y">
            {rows.map((courier) => {
              const stat = stats.get(courier.profile_id) ?? { active: 0, delivered: 0, failed: 0, rejected: 0 };
              const last = recent.get(courier.profile_id) ?? [];
              const recentAvg = last.length ? last.reduce((a, b) => a + b, 0) / last.length : null;
              const alert = recentAvg !== null && last.length >= 3 && recentAvg < RATING_ALERT;
              const name = courier.profile?.full_name || "Repartidor";
              return (
                <li key={courier.profile_id} data-courier={courier.profile?.email} className="flex flex-wrap items-center gap-4 px-5 py-4 text-sm">
                  <Avatar name={name} url={courier.profile?.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {name}
                      {!courier.is_active ? (
                        <Badge tone="gray">Inactivo</Badge>
                      ) : courier.is_online ? (
                        <Badge tone="green">En turno</Badge>
                      ) : (
                        <Badge tone="gray">Fuera de turno</Badge>
                      )}
                      {alert && (
                        <Badge tone="red">
                          <AlertTriangle className="size-3" /> Calificación baja
                        </Badge>
                      )}
                    </p>
                    <p className="text-muted-foreground">
                      {courier.profile?.email}
                      {courier.profile?.phone && ` · ${formatPhone(courier.profile.phone)}`} · {VEHICLE_LABEL[courier.vehicle]}
                      {courier.plate && ` ${courier.plate}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {stat.active} activa(s) · {stat.delivered} entregadas · {stat.failed} intento(s) fallido(s) · {stat.rejected} rechazo(s)
                      {courier.last_seen_at && ` · visto ${formatDate(courier.last_seen_at)}`}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 font-medium" title="Promedio general">
                    <Star className="size-4 fill-warning text-warning" />
                    {courier.rating_count ? `${Number(courier.rating_avg).toFixed(1)} (${courier.rating_count})` : "—"}
                  </span>
                  <CourierActiveSwitch userId={courier.profile_id} active={courier.is_active} />
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader title="Calificaciones bajas recientes" description="1 o 2 estrellas. Revisa con el repartidor y, si corresponde, con el cliente." />
        <ul className="divide-y text-sm">
          {lowRatings.map((r) => {
            const courier = rows.find((c) => c.profile_id === r.courier_id);
            const order = r.order as unknown as { order_number: string } | null;
            return (
              <li key={`${r.courier_id}-${r.created_at}`} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <span className="font-medium">{courier?.profile?.full_name}</span>
                <span className="text-muted-foreground">{order?.order_number}</span>
                <Badge tone="red">{r.rating} ★</Badge>
                <span className="min-w-0 flex-1">{[r.tags.join(", "), r.comment].filter(Boolean).join(" · ")}</span>
                <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
              </li>
            );
          })}
          {lowRatings.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground">Sin calificaciones bajas.</li>}
        </ul>
      </Card>
    </>
  );
}
