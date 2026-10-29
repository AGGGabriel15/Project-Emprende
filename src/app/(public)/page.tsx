import { ArrowRight, Bike, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { BusinessCard } from "@/components/catalog/business-card";
import { CategoryChips } from "@/components/catalog/category-chips";
import { ProductCard } from "@/components/catalog/product-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";
import {
  getPlatformZones,
  listBusinesses,
  listCategories,
  searchProducts,
} from "@/features/catalog/queries";
import { businessOpenState, deliveryFor } from "@/features/catalog/meta";
import { getVisitorLocation } from "@/features/location/server";

export default async function HomePage() {
  const [categories, businesses, featured, location] = await Promise.all([
    listCategories(),
    listBusinesses({ limit: 12 }),
    searchProducts({ limit: 8 }),
    getVisitorLocation(),
  ]);
  const delivery = deliveryFor(await getPlatformZones(), location);
  const openCount = businesses.filter((b) => businessOpenState(b).open).length;

  return (
    <>
      <section className="pattern-clay text-hero-foreground">
        <div className="container-page grid gap-8 py-12 md:grid-cols-[1.2fr_1fr] md:py-16">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
              Catarina, Masaya · el balcón de los pueblos
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
              Artesanías, plantas y flores directo de quienes las hacen
            </h1>
            <p className="mt-4 max-w-xl text-base text-muted-foreground sm:text-lg">
              Compra a los viveros y talleres de Catarina. Cada negocio prepara tu
              pedido y te lo envía o lo retiras en el local.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/buscar">
                  Explorar productos <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="bg-card">
                <Link href="/vender">Vender en Catarina Market</Link>
              </Button>
            </div>
          </div>
          <ul className="grid content-center gap-3 text-sm">
            {[
              { icon: Store, title: `${businesses.length} negocios locales`, text: `${openCount} abiertos ahora mismo` },
              { icon: Bike, title: "Delivery o para llevar", text: "Tarifa clara según tu departamento" },
              { icon: ShieldCheck, title: "Pago seguro", text: "Tu pedido entra a preparación al confirmarse el pago" },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex items-center gap-4 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                  <Icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold">{title}</span>
                  <span className="text-muted-foreground">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="container-page space-y-12 py-10">
        <section aria-labelledby="cats">
          <h2 id="cats" className="sr-only">Categorías</h2>
          <CategoryChips categories={categories} />
        </section>

        <section aria-labelledby="negocios">
          <SectionTitle id="negocios" title="Negocios de Catarina" href="/negocios" />
          {businesses.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {businesses.slice(0, 8).map((business) => (
                <BusinessCard key={business.id} business={business} location={location} delivery={delivery} />
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Store />}
              title="Aún no hay negocios publicados"
              description="Los negocios aparecen aquí cuando la administración aprueba su solicitud."
              action={
                <Button asChild>
                  <Link href="/vender">Registrar mi negocio</Link>
                </Button>
              }
            />
          )}
        </section>

        {featured.products.length > 0 && (
          <section aria-labelledby="nuevos">
            <SectionTitle id="nuevos" title="Recién llegados" href="/buscar" />
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {featured.products.map((product) => (
                <ProductCard key={product.id} product={product} business={product.business} />
              ))}
            </div>
          </section>
        )}

        <section className="grid items-center gap-6 rounded-(--radius-card) border bg-card p-6 sm:p-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-2xl font-semibold">¿Tienes un vivero o taller en Catarina?</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Publica tu catálogo, recibe pedidos en tiempo real y cobra en línea.
              Sin mensualidad: solo una comisión cuando vendes.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/vender">Quiero vender</Link>
          </Button>
        </section>
      </div>
    </>
  );
}

function SectionTitle({ id, title, href }: { id: string; title: string; href: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 id={id} className="text-2xl font-semibold">
        {title}
      </h2>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        Ver todo <ArrowRight className="size-4" />
      </Link>
    </div>
  );
}
