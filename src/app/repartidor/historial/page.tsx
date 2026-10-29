import { History, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState, PageHeader, StatCard } from "@/components/ui/card";
import { SHIPMENT_STATUS } from "@/features/couriers/status";
import { requireCourier } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";
import type { Courier, ShipmentStatus } from "@/types/domain";

export const metadata: Metadata = { title: "Historial" };

type Finished = {
  id: string;
  status: ShipmentStatus;
  order_number: string;
  business: string;
  municipality: string | null;
  delivered_at: string | null;
  updated_at: string;
  rating: number | null;
};

/** Entregas terminadas: sin datos personales del cliente. */
export default async function CourierHistory() {
  const { profile } = await requireCourier("/repartidor/historial");
  const supabase = await createClient();
  const [{ data }, { data: courier }] = await Promise.all([
    supabase.rpc("courier_deliveries", { p_scope: "history" }),
    supabase.from("couriers").select("*").eq("profile_id", profile.id).single<Courier>(),
  ]);
  const rows = (data ?? []) as Finished[];
  const delivered = rows.filter((r) => r.status === "delivered").length;

  return (
    <>
      <PageHeader title="Historial" description="Tus entregas terminadas y cómo te calificaron." />
      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard label="Entregadas" value={String(delivered)} />
        <StatCard
          label="Calificación"
          value={courier?.rating_count ? `${Number(courier.rating_avg).toFixed(1)} ★` : "—"}
          hint={courier?.rating_count ? `${courier.rating_count} calificaciones` : "Aún sin calificaciones"}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState icon={<History />} title="Todavía no tienes entregas terminadas" />
      ) : (
        <Card>
          <ul className="divide-y">
            {rows.map((row) => {
              const [label, tone] = SHIPMENT_STATUS[row.status];
              return (
                <li key={row.id}>
                  <Link href={`/repartidor/entrega/${row.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {row.order_number} <Badge tone={tone}>{label}</Badge>
                      </p>
                      <p className="text-muted-foreground">
                        {row.business} → {row.municipality} · {formatDate(row.delivered_at ?? row.updated_at)}
                      </p>
                    </div>
                    {row.rating && (
                      <span className="inline-flex items-center gap-1 font-medium">
                        <Star className="size-4 fill-warning text-warning" /> {row.rating}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </>
  );
}
