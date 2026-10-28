import { Compass } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[70dvh] place-items-center py-12 text-center">
      <div>
        <span className="mx-auto grid size-16 place-items-center rounded-full bg-primary-soft text-primary">
          <Compass className="size-7" />
        </span>
        <h1 className="mt-4 text-3xl font-semibold">No encontramos esa página</h1>
        <p className="mt-2 text-muted-foreground">Puede que el producto o negocio ya no esté disponible.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button asChild>
            <Link href="/buscar">Explorar productos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Inicio</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
