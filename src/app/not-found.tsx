import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="container-page grid min-h-[560px] place-items-center py-12 text-center">
      <div>
        <p className="font-serif text-7xl font-bold text-[#e89c3f]">404</p>
        <h1 className="mt-3 text-4xl font-bold">No encontramos esa página</h1>
        <p className="mt-3 text-[#65736b]">
          Quizá el producto ya no está disponible.
        </p>
        <Button asChild className="mt-6">
          <Link href="/productos">Volver al catálogo</Link>
        </Button>
      </div>
    </div>
  );
}
