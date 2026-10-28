"use client";

import { MapPinned, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { LocationSelects } from "@/components/customer/location-selects";
import { useGeo } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { deleteZone, saveZone, setServices } from "@/features/businesses/actions";
import { formatMoney } from "@/lib/utils";
import type { DeliveryZone } from "@/types/domain";

export function DeliveryEditor({
  acceptsDelivery,
  acceptsPickup,
  zones,
}: {
  acceptsDelivery: boolean;
  acceptsPickup: boolean;
  zones: DeliveryZone[];
}) {
  const router = useRouter();
  const { departments, municipalities } = useGeo();
  const [pending, startTransition] = useTransition();
  const [zone, setZone] = useState({ departmentId: 11, municipalityId: 0, fee: "", estimatedDays: "1" });

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, message: string, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) return void toast.error(result.error);
      toast.success(message);
      after?.();
      router.refresh();
    });

  const zoneName = (z: DeliveryZone) => {
    const dept = departments.find((d) => d.id === z.department_id)?.name;
    const muni = municipalities.find((m) => m.id === z.municipality_id)?.name;
    return muni ? `${muni}, ${dept}` : `Todo ${dept}`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Servicios que ofreces" />
        <CardBody className="space-y-4">
          <Switch
            id="pickup"
            checked={acceptsPickup}
            onCheckedChange={(checked) => run(() => setServices({ acceptsPickup: checked, acceptsDelivery }), "Servicios actualizados.")}
            label="Para llevar"
            description="El cliente retira en tu local, sin costo de envío."
            disabled={pending}
          />
          <Switch
            id="delivery"
            checked={acceptsDelivery}
            onCheckedChange={(checked) => run(() => setServices({ acceptsPickup, acceptsDelivery: checked }), "Servicios actualizados.")}
            label="Delivery"
            description="Tú gestionas el envío; la tarifa pasa íntegra a tu negocio (sin comisión)."
            disabled={pending}
          />
        </CardBody>
      </Card>

      <Card className={acceptsDelivery ? undefined : "opacity-60"}>
        <CardHeader title="Zonas y tarifas de envío" description="Una tarifa por departamento, o por municipio si quieres un precio distinto." />
        <CardBody className="space-y-5">
          <form
            className="space-y-4 rounded-2xl bg-muted/50 p-4"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => saveZone(zone), "Zona guardada.", () => setZone({ ...zone, fee: "" }));
            }}
          >
            <LocationSelects
              idPrefix="zone"
              allowAnyMunicipality
              departmentId={zone.departmentId}
              municipalityId={zone.municipalityId}
              onChange={(value) => setZone({ ...zone, ...value })}
            />
            <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Field label="Tarifa (C$)" htmlFor="zone-fee">
                <Input id="zone-fee" type="number" min={0} step="0.01" value={zone.fee} onChange={(e) => setZone({ ...zone, fee: e.target.value })} />
              </Field>
              <Field label="Días estimados" htmlFor="zone-days">
                <Input id="zone-days" type="number" min={0} max={30} value={zone.estimatedDays} onChange={(e) => setZone({ ...zone, estimatedDays: e.target.value })} />
              </Field>
              <Button type="submit" disabled={!acceptsDelivery || zone.fee === "" || !zone.departmentId} loading={pending}>
                Guardar zona
              </Button>
            </div>
          </form>
          {zones.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPinned className="size-4" /> Sin zonas: nadie podrá pedir con delivery.
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {zones.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="font-medium">{zoneName(z)}</span>
                  <span className="ml-auto text-muted-foreground">
                    {z.estimated_days === 0 ? "Mismo día" : `${z.estimated_days} día(s)`}
                  </span>
                  <span className="w-24 text-right font-semibold tabular-nums">{formatMoney(z.fee_minor)}</span>
                  <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="Eliminar zona" onClick={() => run(() => deleteZone(z.id), "Zona eliminada.")}>
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
