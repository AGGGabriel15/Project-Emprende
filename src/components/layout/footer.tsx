import { Sprout } from "lucide-react";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-20 bg-[#173e30] py-10 text-[#e8f1eb]">
      <div className="container-page grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2 font-serif text-xl">
            <Sprout /> Emprendedores Unidos
          </div>
          <p className="max-w-sm text-sm leading-6 text-[#c9d9cf]">
            Una vitrina digital para el talento, los sabores y la tradición de
            Catarina, Masaya.
          </p>
        </div>
        <div>
          <p className="mb-3 text-xs font-bold tracking-widest text-[#efb66f] uppercase">
            Explora
          </p>
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/productos">Todos los productos</Link>
            <Link href="/registro">Vender en la plataforma</Link>
          </div>
        </div>
        <div className="text-sm text-[#c9d9cf] lg:text-right">
          <p>Proyecto académico</p>
          <p>© {new Date().getFullYear()} Emprendedores Unidos de Catarina</p>
        </div>
      </div>
    </footer>
  );
}
