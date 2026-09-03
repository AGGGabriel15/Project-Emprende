import type { Metadata } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import { ProductCard } from "@/components/products/product-card";
import { serverApiEnvelope } from "@/lib/server-api";
import type { ProductView } from "@/types/domain";

export const metadata: Metadata = { title: "Productos" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  categoria?: string;
  emprendedor?: string;
  page?: string;
}>;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.categoria) query.set("categoria", params.categoria);
  if (params.emprendedor) query.set("emprendedor", params.emprendedor);
  if (params.page) query.set("page", params.page);
  const result = await serverApiEnvelope<ProductView[]>(
    `/api/productos?${query.toString()}`,
  );
  const products = result?.data ?? [];
  const page = result?.meta?.page ?? 1;
  const pages = result?.meta?.pages ?? 1;
  const pageUrl = (target: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(target));
    return `/productos?${next.toString()}`;
  };
  return (
    <div className="container-page py-12">
      <div className="max-w-2xl">
        <p className="text-sm font-bold tracking-widest text-[#c87724] uppercase">
          Catálogo local
        </p>
        <h1 className="mt-2 text-5xl font-bold">
          Encuentra algo hecho para ti
        </h1>
        <p className="mt-4 text-[#65736b]">
          Busca entre artesanías, plantas y sabores de emprendedores de
          Catarina.
        </p>
      </div>
      <form
        className="mt-9 grid gap-3 rounded-2xl border bg-white p-3 shadow-sm sm:grid-cols-[1fr_210px_auto]"
        action="/productos"
      >
        <label className="relative">
          <span className="sr-only">Buscar</span>
          <Search
            className="absolute top-3.5 left-3.5 text-[#75837b]"
            size={18}
          />
          <input
            name="q"
            defaultValue={params.q}
            placeholder="Buscar productos..."
            className="h-11 w-full rounded-xl bg-[#f7f7f3] pr-4 pl-10 text-sm outline-none focus:ring-2 focus:ring-[#236b4e]/20"
          />
          {params.emprendedor && (
            <input
              type="hidden"
              name="emprendedor"
              value={params.emprendedor}
            />
          )}
        </label>
        <select
          name="categoria"
          defaultValue={params.categoria ?? ""}
          className="h-11 rounded-xl bg-[#f7f7f3] px-4 text-sm"
        >
          <option value="">Todas las categorías</option>
          <option value="artesanias">Artesanías</option>
          <option value="plantas">Plantas</option>
          <option value="comida">Comida</option>
        </select>
        <button className="rounded-xl bg-[#236b4e] px-6 font-bold text-white">
          Buscar
        </button>
      </form>
      <div className="mt-10">
        {products.length ? (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            {pages > 1 && (
              <nav
                aria-label="Paginación"
                className="mt-10 flex items-center justify-center gap-4"
              >
                <Link
                  aria-disabled={page <= 1}
                  className={`rounded-full border bg-white px-5 py-2 text-sm font-bold ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}
                  href={pageUrl(page - 1)}
                >
                  Anterior
                </Link>
                <span className="text-sm text-[#65736b]">
                  Página {page} de {pages}
                </span>
                <Link
                  aria-disabled={page >= pages}
                  className={`rounded-full border bg-white px-5 py-2 text-sm font-bold ${page >= pages ? "pointer-events-none opacity-40" : ""}`}
                  href={pageUrl(page + 1)}
                >
                  Siguiente
                </Link>
              </nav>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed bg-white p-14 text-center">
            <h2 className="text-2xl">No encontramos productos</h2>
            <p className="mt-2 text-[#65736b]">
              Prueba con otra búsqueda o limpia los filtros.
            </p>
            <Link
              href="/productos"
              className="mt-5 inline-block font-bold text-[#236b4e]"
            >
              Ver todo el catálogo
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
