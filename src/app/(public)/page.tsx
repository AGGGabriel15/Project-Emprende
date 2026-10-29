import { ArrowRight, Store } from "lucide-react";
import Image from "next/image";
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
import { deliveryFor } from "@/features/catalog/meta";
import { getVisitorLocation } from "@/features/location/server";

export default async function HomePage() {
  const [categories, businesses, featured, location] = await Promise.all([
    listCategories(),
    listBusinesses({ limit: 12 }),
    searchProducts({ limit: 8 }),
    getVisitorLocation(),
  ]);
  const delivery = deliveryFor(await getPlatformZones(), location);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-bosque">
        <Image
          src="/brand/mirador-catarina.jpg"
          alt="La Laguna de Apoyo vista desde el Mirador de Catarina"
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[center_62%]"
        />
        <div aria-hidden className="absolute inset-0 -z-10 bg-linear-to-b from-bosque/55 via-bosque/30 to-bosque/70 md:bg-linear-to-r md:from-bosque/70 md:via-bosque/25 md:to-transparent" />
        <div className="container-page py-14 sm:py-20 md:py-28">
          <div className="max-w-2xl rounded-[2rem] border border-white/30 bg-bosque/30 p-6 text-white shadow-[0_24px_60px_-20px_rgb(14_59_39/0.6)] backdrop-blur-xl backdrop-saturate-150 sm:p-10">
            <p className="text-xs font-semibold tracking-[0.2em] text-hoja-clara uppercase">
              Catarina, Masaya · el balcón de los pueblos
            </p>
            <h1 className="mt-3 text-4xl leading-tight font-semibold sm:text-5xl">
              Artesanías, plantas y flores directo de quienes las hacen
            </h1>
            <p className="mt-4 max-w-xl text-base text-white/85 sm:text-lg">
              Compra a los viveros y talleres de Catarina. Cada negocio prepara tu
              pedido y te lo envía o lo retiras en el local.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/buscar">
                  Explorar productos <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white/50 bg-white/10 text-white hover:border-white hover:bg-white/20 hover:text-white">
                <Link href="/vender">Vender en Catarina Market</Link>
              </Button>
            </div>
          </div>
        </div>
        <a
          href="https://commons.wikimedia.org/wiki/File:Laguna_de_Apoyo.jpg"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute right-3 bottom-2 text-[10px] text-white/60 hover:text-white"
        >
          Mirador de Catarina · Foto: Jesús Jiménez, CC BY-SA 2.0 (editada)
        </a>
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

        <section className="pattern-brand-green grid items-center gap-6 rounded-(--radius-card) p-6 text-white sm:p-10 md:grid-cols-[1fr_auto]">
          <div>
            <h2 className="text-2xl font-semibold">¿Tienes un vivero o taller en Catarina?</h2>
            <p className="mt-2 max-w-2xl text-white/85">
              Publica tu catálogo, recibe pedidos en tiempo real y cobra en línea.
              Sin mensualidad: solo una comisión cuando vendes.
            </p>
          </div>
          <Button asChild size="lg" variant="outline" className="border-white bg-white text-catarina hover:bg-niebla hover:text-catarina">
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
