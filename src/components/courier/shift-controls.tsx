"use client";

import { Check, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { acceptShipment, setOnline } from "@/features/couriers/actions";
import { currentPosition } from "@/lib/position";
import { cn } from "@/lib/utils";

/** Entrar o salir de turno: solo en turno se reciben y aceptan pedidos. */
export function OnlineToggle({ online }: { online: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const toggle = (next: boolean) =>
    startTransition(async () => {
      const position = next ? await currentPosition() : null;
      const result = await setOnline(next, position?.lat, position?.lng);
      if (!result.ok) return void toast.error(result.error);
      toast.success(next ? "Estás en turno: te avisaremos de pedidos nuevos." : "Saliste de turno.");
      router.refresh();
    });
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-2xl border p-4",
        online ? "border-primary/40 bg-primary-soft" : "bg-card",
      )}
    >
      <Power className={cn("size-6", online ? "text-primary" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{online ? "En turno" : "Fuera de turno"}</p>
        <p className="text-sm text-muted-foreground">
          {online ? "Recibes los pedidos disponibles." : "Actívalo para ver y aceptar pedidos."}
        </p>
      </div>
      <Switch checked={online} disabled={pending} onCheckedChange={toggle} aria-label="En turno" />
    </div>
  );
}

export function AcceptButton({ shipmentId }: { shipmentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      loading={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await acceptShipment(shipmentId);
          if (!result.ok) {
            toast.error(result.error);
            return router.refresh();
          }
          toast.success("Pedido aceptado. Ve al negocio a recogerlo.");
          router.push(`/repartidor/entrega/${shipmentId}`);
        })
      }
    >
      <Check /> Aceptar
    </Button>
  );
}
