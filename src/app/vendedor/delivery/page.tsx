import { Camera, KeyRound, PackageCheck, Truck } from "lucide-react";
import type { Metadata } from "next";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { DeliveryEditor } from "@/components/vendor/delivery-editor";
import { getPlatformZones } from "@/features/catalog/queries";
import { getGeo } from "@/features/location/server";
import { requireApprovedBusiness } from "@/lib/auth";
import { formatMoney } from "@/lib/utils";

export const metadata: Metadata = { title: "Delivery" };

const STEPS = [
  { icon: Camera, title: "Empacas y tomas una foto", text: "Marca el pedido como listo desde el tablero." },
  { icon: Truck, title: "El repartidor lo recoge", text: "Compara el paquete con tu foto; si no coincide, lo rechaza." },
  { icon: KeyRound, title: "Se entrega con PIN", text: "El cliente da su código solo al recibirlo." },
  { icon: PackageCheck, title: "Cobras", text: "48 h después de la entrega, si no hay reclamos." },
];

export default async function DeliveryPage() {
  const { business } = await requireApprovedBusiness("/vendedor/delivery");
  const [zones, geo] = await Promise.all([getPlatformZones(), getGeo()]);
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Entregas"
        description="Catarina Market se encarga del delivery: recogemos en tu negocio y entregamos al cliente. Tú no pagas el envío."
      />
      <Card>
        <CardBody className="grid gap-4 sm:grid-cols-2">
          {STEPS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Icon className="size-5" />
              </span>
              <span className="text-sm">
                <strong className="block">{title}</strong>
                <span className="text-muted-foreground">{text}</span>
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
      <DeliveryEditor acceptsPickup={business.accepts_pickup} />
      <Card>
        <CardHeader title="Zonas con delivery" description="Las tarifas las define Catarina Market y las paga el cliente." />
        <ul className="divide-y text-sm">
          {zones.map((zone) => (
            <li key={zone.id} className="flex justify-between px-5 py-2.5">
              <span>
                {zone.municipality_id
                  ? geo.municipalities.find((m) => m.id === zone.municipality_id)?.name
                  : `Todo ${geo.departments.find((d) => d.id === zone.department_id)?.name}`}
              </span>
              <span className="tabular-nums text-muted-foreground">{formatMoney(zone.fee_minor)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
