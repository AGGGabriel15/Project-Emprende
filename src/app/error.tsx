"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="container-page grid min-h-[560px] place-items-center py-12 text-center">
      <div>
        <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
          Algo salió mal
        </p>
        <h1 className="mt-3 text-4xl font-bold">
          No pudimos cargar esta sección
        </h1>
        <p className="mt-3 text-[#65736b]">
          Comprueba la conexión e inténtalo nuevamente.
        </p>
        <Button className="mt-6" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
