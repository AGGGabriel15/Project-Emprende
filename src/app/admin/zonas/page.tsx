import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-buttons";
import { Card, PageHeader } from "@/components/ui/card";
import { deleteZoneAsAdmin } from "@/features/admin/actions";
import { getGeo } from "@/features/location/server";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Zonas de delivery" };

export default async function ZonesPage() {
  const supabase = await createClient();
  const [{ data }, geo] = await Promise.all([
    supabase.from("delivery_zones").select("*, business:businesses(trade_name)").order("department_id"),
    getGeo(),
  ]);
  const zones = data ?? [];
  const coverage = geo.departments.map((d) => ({
    ...d,
    businesses: new Set(zones.filter((z) => z.department_id === d.id).map((z) => z.business_id)).size,
  }));

  return (
    <>
      <PageHeader title="Zonas de delivery" description="Cobertura de envío de todos los negocios. Cada negocio administra sus propias tarifas." />
      <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {coverage.map((d) => (
          <div key={d.id} className={`rounded-xl border p-3 text-sm ${d.businesses ? "bg-card" : "bg-muted/50 text-muted-foreground"}`}>
            <p className="truncate font-medium">{d.name}</p>
            <p className="text-xs">{d.businesses} negocios</p>
          </div>
        ))}
      </div>
      <Card>
        <ul className="divide-y">
          {zones.map((z) => {
            const business = z.business as unknown as { trade_name: string } | null;
            const dept = geo.departments.find((d) => d.id === z.department_id)?.name;
            const muni = geo.municipalities.find((m) => m.id === z.municipality_id)?.name;
            return (
              <li key={z.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="w-48 font-medium">{business?.trade_name}</span>
                <span className="flex-1">{muni ? `${muni}, ${dept}` : `Todo ${dept}`}</span>
                <span className="text-muted-foreground">{z.estimated_days} día(s)</span>
                <span className="w-24 text-right tabular-nums">{formatMoney(z.fee_minor)}</span>
                <ActionButton variant="ghost" size="icon" className="text-destructive" aria-label="Eliminar zona" confirm="¿Eliminar esta zona?" success="Zona eliminada." action={deleteZoneAsAdmin.bind(null, z.id)}>
                  <Trash2 />
                </ActionButton>
              </li>
            );
          })}
          {zones.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Ningún negocio configuró zonas todavía.</li>}
        </ul>
      </Card>
    </>
  );
}
