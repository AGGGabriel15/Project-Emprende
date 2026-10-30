import { Store } from "lucide-react";
import { redirectPanelUsers } from "@/lib/auth";
import type { Metadata } from "next";
import { BusinessCard } from "@/components/catalog/business-card";
import { CategoryChips } from "@/components/catalog/category-chips";
import { SearchFilters } from "@/components/catalog/search-filters";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { deliveryFor } from "@/features/catalog/meta";
import { getPlatformZones, listBusinesses, listCategories } from "@/features/catalog/queries";
import { getVisitorLocation } from "@/features/location/server";

export const metadata: Metadata = { title: "Negocios" };

type SearchParams = Promise<Record<string, string | undefined>>;

export default async function BusinessesPage({ searchParams }: { searchParams: SearchParams }) {
  await redirectPanelUsers();
  const params = await searchParams;
  const [categories, location, zones] = await Promise.all([listCategories(), getVisitorLocation(), getPlatformZones()]);
  const delivery = deliveryFor(zones, location);
  const category = categories.find((c) => c.slug === params.categoria);
  const businesses = await listBusinesses({
    categoryId: category?.id,
    q: params.q,
    openNow: params.abierto === "1",
    location,
  });

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
        {businesses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {businesses.map((business) => (
              <BusinessCard key={business.id} business={business} location={location} delivery={delivery} />
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

