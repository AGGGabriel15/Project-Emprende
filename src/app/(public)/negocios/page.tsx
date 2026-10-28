import { Store } from "lucide-react";
import type { Metadata } from "next";
import { BusinessCard } from "@/components/catalog/business-card";
import { CategoryChips } from "@/components/catalog/category-chips";
import { SearchFilters } from "@/components/catalog/search-filters";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { listBusinesses, listCategories } from "@/features/catalog/queries";
import { getVisitorLocation } from "@/features/location/server";

export const metadata: Metadata = { title: "Negocios" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function BusinessesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [categories, location] = await Promise.all([listCategories(), getVisitorLocation()]);
  const category = categories.find((c) => c.slug === params.categoria);
  const businesses = await listBusinesses({
    categoryId: category?.id,
    q: params.q,
    openNow: params.abierto === "1",
    location,
  });
  // Primero los que envían a la ubicación del visitante.
  const sorted = location
    ? [...businesses].sort(
        (a, b) =>
          Number(hasZone(b, location.departmentId)) - Number(hasZone(a, location.departmentId)),
      )
    : businesses;

  return (
    <div className="container-page py-8">
      <PageHeader
        title="Negocios de Catarina"
        description="Viveros, talleres de artesanía y floristerías con catálogo propio."
      />
      <div className="space-y-4">
        <SearchFilters showSort={false} />
        <CategoryChips
          categories={categories}
          active={params.categoria}
          baseHref="/negocios"
          params={{ q: params.q, abierto: params.abierto }}
        />
      </div>
      <div className="mt-6">
        {sorted.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {sorted.map((business) => (
              <BusinessCard key={business.id} business={business} location={location} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Store />}
            title="No hay negocios con esos filtros"
            description="Prueba quitando “Abierto ahora” o cambiando la categoría."
          />
        )}
      </div>
    </div>
  );
}

function hasZone(business: { delivery_zones: { department_id: number }[] }, departmentId: number) {
  return business.delivery_zones.some((zone) => zone.department_id === departmentId);
}
