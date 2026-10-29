"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setServices } from "@/features/businesses/actions";

/** El delivery lo hace Catarina Market; el negocio solo decide si acepta retiro en su local. */
export function DeliveryEditor({ acceptsPickup }: { acceptsPickup: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Card>
      <CardHeader title="Retiro en tu local" />
      <CardBody>
        <Switch
          checked={acceptsPickup}
          disabled={pending}
          onCheckedChange={(checked) =>
            startTransition(async () => {
              const result = await setServices({ acceptsPickup: checked, acceptsDelivery: true });
              if (!result.ok) return void toast.error(result.error);
              toast.success("Servicios actualizados.");
              router.refresh();
            })
          }
          label="Aceptar retiro en mi local"
          description="El cliente pasa a recoger y te dice su PIN de 4 dígitos. Sin PIN no puedes entregar."
        />
      </CardBody>
    </Card>
  );
}
