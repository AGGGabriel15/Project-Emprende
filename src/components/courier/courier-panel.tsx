"use client";

import { Camera, CheckCircle2, KeyRound, Loader2, MapPinned, PackageCheck, PackageX, TriangleAlert, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { arrive, courierStep, releaseShipment } from "@/features/couriers/actions";
import type { CourierStage } from "@/features/couriers/status";
import { downscaleImage } from "@/lib/image";
import { currentPosition } from "@/lib/position";

type Kind = "pickup" | "reject" | "deliver" | "fail" | "release";

const COPY: Record<Kind, { title: string; description: string; confirm: string; photo: boolean; notes?: string; pin?: boolean }> = {
  pickup: {
    title: "Confirmar recolección",
    description: "Revisa que el paquete coincida con la foto del negocio y toma una foto al recibirlo.",
    confirm: "Recogí el pedido",
    photo: true,
    notes: "Observaciones (opcional)",
  },
  reject: {
    title: "Rechazar el pedido",
    description: "Úsalo si el producto no coincide con la publicación o viene dañado. Se le devuelve el dinero al cliente.",
    confirm: "Rechazar",
    photo: true,
    notes: "¿Qué está mal? (obligatorio)",
  },
  deliver: {
    title: "Confirmar entrega",
    description: "Pídele al cliente su PIN de 4 dígitos después de que reciba y revise el pedido. Toma una foto de la entrega.",
    confirm: "Entregado",
    photo: true,
    pin: true,
  },
  fail: {
    title: "No se pudo entregar",
    description: "Antes, llama al cliente y espera unos minutos. Al segundo intento fallido el pedido vuelve al negocio.",
    confirm: "Registrar intento",
    photo: false,
    notes: "¿Qué pasó? (cliente ausente, dirección incorrecta…)",
  },
  release: {
    title: "Soltar el pedido",
    description: "Vuelve a la lista de disponibles para otro repartidor. Solo antes de recogerlo.",
    confirm: "Soltar",
    photo: false,
    notes: "¿Por qué lo sueltas?",
  },
};

/** Botones de cada paso de la entrega; cada uno guarda hora, GPS y su evidencia. */
export function CourierPanel({ shipmentId, stage }: { shipmentId: string; stage: CourierStage }) {
  const router = useRouter();
  const [kind, setKind] = useState<Kind | null>(null);
  const [pending, startTransition] = useTransition();

  if (stage === "done") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-success-soft p-4 text-sm font-medium">
        <CheckCircle2 className="size-5 text-success" /> Esta entrega ya terminó. ¡Gracias!
      </p>
    );
  }

  const arrived = (where: "pickup" | "dropoff") =>
    startTransition(async () => {
      const position = await currentPosition();
      const result = await arrive(shipmentId, where, position?.lat, position?.lng);
      if (!result.ok) return void toast.error(result.error);
      toast.success(where === "pickup" ? "Le avisamos al negocio que llegaste." : "Le avisamos al cliente que llegaste.");
      router.refresh();
    });

  return (
    <div className="space-y-3">
      {stage === "to_pickup" && (
        <Button size="lg" className="w-full" loading={pending} onClick={() => arrived("pickup")}>
          <MapPinned /> Llegué al negocio
        </Button>
      )}
      {stage === "at_pickup" && (
        <>
          <Button size="lg" className="w-full" onClick={() => setKind("pickup")}>
            <PackageCheck /> Recogí el pedido
          </Button>
          <Button size="lg" variant="outline" className="w-full text-destructive" onClick={() => setKind("reject")}>
            <PackageX /> No coincide / viene dañado
          </Button>
        </>
      )}
      {stage === "to_dropoff" && (
        <Button size="lg" className="w-full" loading={pending} onClick={() => arrived("dropoff")}>
          <MapPinned /> Llegué donde el cliente
        </Button>
      )}
      {stage === "at_dropoff" && (
        <Button size="lg" className="w-full" onClick={() => setKind("deliver")}>
          <KeyRound /> Entregar con PIN
        </Button>
      )}
      {(stage === "to_dropoff" || stage === "at_dropoff") && (
        <Button size="lg" variant="outline" className="w-full" onClick={() => setKind("fail")}>
          <TriangleAlert /> No pude entregar
        </Button>
      )}
      {(stage === "to_pickup" || stage === "at_pickup") && (
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setKind("release")}>
          <Undo2 /> Soltar el pedido
        </Button>
      )}
      <ActionDialog shipmentId={shipmentId} kind={kind} onClose={() => setKind(null)} />
    </div>
  );
}

function ActionDialog({ shipmentId, kind, onClose }: { shipmentId: string; kind: Kind | null; onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [pin, setPin] = useState("");
  const [pending, startTransition] = useTransition();
  const copy = kind ? COPY[kind] : null;
  const ready =
    copy &&
    (!copy.photo || file) &&
    (!copy.pin || pin.length === 4) &&
    (kind === "pickup" || !copy.notes || notes.trim().length >= 5);

  function close() {
    setFile(null);
    setNotes("");
    setPin("");
    onClose();
  }

  function submit(current: Kind) {
    startTransition(async () => {
      try {
        if (current === "release") {
          const result = await releaseShipment(shipmentId, notes);
          if (!result.ok) throw new Error(result.error);
          toast.success("Pedido liberado.");
          close();
          router.push("/repartidor");
          return;
        }
        const form = new FormData();
        const [photo, position] = await Promise.all([file ? downscaleImage(file) : null, currentPosition()]);
        if (photo) form.set("photo", photo);
        if (position) {
          form.set("lat", String(position.lat));
          form.set("lng", String(position.lng));
        }
        form.set("notes", notes);
        form.set("pin", pin);
        const result = await courierStep(shipmentId, current, form);
        if (!result.ok) throw new Error(result.error);
        toast.success(current === "deliver" ? "¡Entregado!" : "Registrado.");
        close();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo registrar.");
      }
    });
  }

  return (
    <Dialog open={Boolean(kind)} onOpenChange={(open) => !open && close()}>
      {kind && copy && (
        <DialogContent side="sheet" title={copy.title} description={copy.description}>
          <div className="space-y-4">
            {copy.photo && (
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-sm hover:border-primary">
                <Camera className="size-6 text-primary" />
                <span className="flex-1">{file ? file.name : "Tomar foto"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="sr-only"
                  aria-label="Foto"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}
            {copy.pin && (
              <Field label="PIN del cliente" htmlFor="courier-pin">
                <Input
                  id="courier-pin"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  className="text-center text-2xl font-semibold tracking-[0.5em]"
                />
              </Field>
            )}
            {copy.notes && (
              <Field label={copy.notes} htmlFor="courier-notes">
                <Textarea id="courier-notes" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            )}
            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="flex-1" onClick={close}>
                Volver
              </Button>
              <Button
                className="flex-1"
                variant={kind === "reject" ? "danger" : "primary"}
                disabled={!ready}
                loading={pending}
                onClick={() => submit(kind)}
              >
                {pending && <Loader2 className="animate-spin" />} {copy.confirm}
              </Button>
            </div>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}
