"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page grid min-h-[70dvh] place-items-center py-12 text-center">
      <div>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-destructive-soft text-destructive">
          <AlertTriangle className="size-7" />
        </span>
        <h1 className="mt-4 text-3xl font-semibold">Algo salió mal</h1>
        <p className="mt-2 text-muted-foreground">Comprueba tu conexión e inténtalo de nuevo.</p>
        <Button className="mt-6" onClick={reset}>
          Reintentar
        </Button>
      </div>
    </div>
  );
}
