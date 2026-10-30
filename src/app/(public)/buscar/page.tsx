import { SearchX } from "lucide-react";
import { redirectPanelUsers } from "@/lib/auth";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryChips } from "@/components/catalog/category-chips";
import { ProductCard } from "@/components/catalog/product-card";
import { SearchFilters } from "@/components/catalog/search-filters";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { listCategories, searchProducts } from "@/features/catalog/queries";

export const metadata: Metadata = { title: "Explorar productos" };

const PAGE_SIZE = 24;

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  await redirectPanelUsers();
  const params = await searchParams;
  const page = Math.max(1, Number(params.pagina) || 1);
  const categories = await listCategories();
  const category = categories.find((c) => c.slug === params.categoria);
  const sort = (["recent", "price_asc", "price_desc"] as const).find((s) => s === params.orden);
  const { products, total } = await searchProducts({
    q: params.q,
    categoryId: category?.id,
    openNow: params.abierto === "1",
    sort,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.ceil(total / PAGE_SIZE);
  const pageHref = (n: number) => {
    const search = new URLSearchParams(
      Object.entries({ ...params, pagina: String(n) }).filter(
        (entry): entry is [string, string] => Boolean(entry[1]),
      ),
    );
    return `/buscar?${search}`;
  };

  return (
    <div className="container-page py-8">
      <PageHeader
        title={params.q ? `Resultados para “${params.q}”` : category ? category.name : "Explorar productos"}
        description={`${total} ${total === 1 ? "producto" : "productos"} de negocios de Catarina`}
      />
      <div className="space-y-4">
        <SearchFilters />
        <CategoryChips
          categories={categories}
          active={params.categoria}
          params={{ q: params.q, abierto: params.abierto, orden: params.orden }}
        />
      </div>

      <div className="mt-6">
        {products.length ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} business={product.business} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<SearchX />}
            title="No encontramos productos"
            description="Prueba con otra palabra, quita filtros o explora por categoría."
            action={
              <Button asChild variant="outline">
                <Link href="/buscar">Limpiar filtros</Link>
              </Button>
            }
          />
        )}
      </div>

      {pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Paginación">
          {page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page - 1)}>Anterior</Link>
            </Button>
          )}
          <span className="px-3 text-sm text-muted-foreground">
            Página {page} de {pages}
          </span>
          {page < pages && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(page + 1)}>Siguiente</Link>
            </Button>
          )}
        </nav>
      )}
    </div>
  );
}
