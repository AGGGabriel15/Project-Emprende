import { Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { ActionButton } from "@/components/admin/action-buttons";
import { ZoneForm } from "@/components/admin/zone-form";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { deleteZoneAsAdmin } from "@/features/admin/actions";
import { getGeo } from "@/features/location/server";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMoney } from "@/lib/utils";
import type { PlatformZone } from "@/types/domain";

export const metadata: Metadata = { title: "Zonas de delivery" };

export default async function ZonesPage() {
  const supabase = await createClient();
  const [{ data }, geo] = await Promise.all([
    supabase.from("platform_delivery_zones").select("*").order("department_id").order("municipality_id", { nullsFirst: true }),
    getGeo(),
  ]);
  const zones = (data ?? []) as PlatformZone[];

  return (
    <>
      <PageHeader
        title="Zonas de delivery"
        description="Los repartidores de Catarina Market recogen en el negocio y entregan al cliente. La tarifa del municipio gana a la del departamento; sin tarifa, solo hay retiro en el negocio."
      />
      <Card className="mb-6">
        <CardHeader title="Nueva tarifa o actualizar una existente" />
        <CardBody>
          <ZoneForm />
        </CardBody>
      </Card>
      <Card>
        <ul className="divide-y">
          {zones.map((zone) => {
            const dept = geo.departments.find((d) => d.id === zone.department_id)?.name;
            const muni = geo.municipalities.find((m) => m.id === zone.municipality_id)?.name;
            const margin = zone.fee_minor - zone.courier_cost_minor;
            return (
              <li key={zone.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-48 flex-1 font-medium">{muni ? `${muni}, ${dept}` : `Todo ${dept}`}</span>
                <span className="text-muted-foreground">{zone.estimated_days === 0 ? "Mismo día" : `${zone.estimated_days} día(s)`}</span>
                <span className="w-32 text-right tabular-nums">Cliente {formatMoney(zone.fee_minor)}</span>
                <span className="w-36 text-right tabular-nums text-muted-foreground">Mensajería {formatMoney(zone.courier_cost_minor)}</span>
                <span className={cn("w-28 text-right font-semibold tabular-nums", margin < 0 ? "text-destructive" : "text-success")}>
                  {margin >= 0 ? "+" : ""}
                  {formatMoney(margin)}
                </span>
                <ActionButton variant="ghost" size="icon" className="text-destructive" aria-label="Eliminar zona" confirm="¿Eliminar esta tarifa? Esa zona quedará sin delivery." success="Tarifa eliminada." action={deleteZoneAsAdmin.bind(null, zone.id)}>
                  <Trash2 />
                </ActionButton>
              </li>
            );
          })}
          {zones.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted-foreground">Sin tarifas: solo hay retiro en el negocio.</li>}
        </ul>
      </Card>
    </>
  );
}
