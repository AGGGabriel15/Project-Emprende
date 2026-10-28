"use client";

import { ChevronDown, MapPin } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useGeo } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLocation } from "@/features/location/store";
import { saveProfileLocation } from "@/features/account/actions";
import { cn } from "@/lib/utils";
import { LocationSelects } from "./location-selects";

const BROWSE_PATHS = ["/", "/buscar", "/negocios", "/productos"];

const subscribe = (callback: () => void) =>
  useLocation.persist.onFinishHydration(callback);

/** Chip del navbar: muestra la ciudad y abre el diálogo de ubicación. */
export function LocationPicker({
  isLoggedIn,
  profileLocation,
  compact,
}: {
  isLoggedIn: boolean;
  profileLocation: { departmentId: number; municipalityId: number } | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { municipalities } = useGeo();
  const { departmentId, municipalityId, setLocation, promptDismissed, dismissPrompt } = useLocation();
  const hydrated = useSyncExternalStore(
    subscribe,
    () => useLocation.persist.hasHydrated(),
    () => false,
  );
  const [userOpen, setUserOpen] = useState(false);
  const [draft, setDraft] = useState<{ departmentId: number; municipalityId: number } | null>(null);

  // Usuario con ubicación en el perfil: se usa como valor inicial.
  useEffect(() => {
    if (hydrated && !municipalityId && profileLocation) {
      setLocation(profileLocation.departmentId, profileLocation.municipalityId);
      router.refresh();
    }
  }, [hydrated, municipalityId, profileLocation, setLocation, router]);

  // Primera visita sin ubicación: se pide al explorar el catálogo (no exige cuenta),
  // nunca encima del login, el carrito o el checkout.
  const browsing = BROWSE_PATHS.some((path) => (path === "/" ? pathname === "/" : pathname.startsWith(path)));
  const open =
    userOpen || (!compact && browsing && hydrated && !municipalityId && !profileLocation && !promptDismissed);
  const setOpen = (next: boolean) => {
    setUserOpen(next);
    if (!next) dismissPrompt();
  };

  const current = municipalities.find((m) => m.id === municipalityId);
  const value = draft ?? { departmentId: departmentId ?? 0, municipalityId: municipalityId ?? 0 };

  async function save() {
    if (!value.departmentId || !value.municipalityId) return;
    setLocation(value.departmentId, value.municipalityId);
    if (isLoggedIn) await saveProfileLocation(value);
    setOpen(false);
    setDraft(null);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (setOpen(next), setDraft(null))}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "flex min-w-0 cursor-pointer items-center gap-1.5 rounded-full text-left text-sm transition hover:text-primary",
          compact ? "max-w-[55vw]" : "max-w-56 border px-3 py-2 hover:border-primary",
        )}
      >
        <MapPin className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          {!compact && <span className="block text-[11px] leading-none text-muted-foreground">Entregar en</span>}
          <span className="block truncate font-medium">
            {hydrated && current ? current.name : "Elige tu ubicación"}
          </span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>
      <DialogContent
        side="sheet"
        title="¿Dónde estás?"
        description="Te mostramos qué negocios envían a tu zona y cuánto cuesta el delivery. No necesitas cuenta para explorar."
      >
        <LocationSelects
          idPrefix="picker"
          departmentId={value.departmentId || null}
          municipalityId={value.municipalityId || null}
          onChange={setDraft}
        />
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={!value.departmentId || !value.municipalityId}
          onClick={save}
        >
          Guardar ubicación
        </Button>
      </DialogContent>
    </Dialog>
  );
}
