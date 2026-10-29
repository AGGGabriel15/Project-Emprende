"use client";

import { Crosshair, ExternalLink, Loader2, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { mapsUrl } from "@/lib/maps";

/** Ubicación exacta del negocio con el GPS del teléfono (para la visita y la recolección). */
export function GeoLocationField({
  latitude,
  longitude,
  required,
  onChange,
}: {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  required?: boolean;
  onChange: (value: { latitude: number; longitude: number }) => void;
}) {
  const [busy, setBusy] = useState(false);
  const hasValue = latitude != null && longitude != null;

  function locate() {
    if (!navigator.geolocation) return void toast.error("Tu navegador no permite obtener la ubicación.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBusy(false);
        onChange({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
        });
        toast.success("Ubicación guardada.");
      },
      () => {
        setBusy(false);
        toast.error("No pudimos obtener tu ubicación. Activa el GPS y da permiso al navegador.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  return (
    <div className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <MapPin className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            Ubicación exacta {required ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(recomendada)</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {hasValue
              ? `${latitude}, ${longitude}`
              : "Hazlo desde tu negocio: la usamos para la visita de verificación y para recoger tus pedidos."}
          </p>
        </div>
        <Button type="button" size="sm" variant={hasValue ? "outline" : "primary"} onClick={locate} disabled={busy}>
          {busy ? <Loader2 className="animate-spin" /> : <Crosshair />}
          {hasValue ? "Actualizar" : "Usar mi ubicación actual"}
        </Button>
      </div>
      {hasValue && (
        <a
          href={mapsUrl(latitude, longitude)}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Ver en el mapa <ExternalLink className="size-3" />
        </a>
      )}
    </div>
  );
}
