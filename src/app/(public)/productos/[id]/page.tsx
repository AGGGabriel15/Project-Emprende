import { Bike, ChevronRight, Ruler, Scale, Shapes, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/catalog/add-to-cart";
import { OpenBadge } from "@/components/catalog/open-badge";
import { ProductGallery } from "@/components/catalog/product-gallery";
import { Rating } from "@/components/catalog/rating";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { businessOpenState, deliveryFor } from "@/features/catalog/meta";
import { getPlatformZones, getProduct } from "@/features/catalog/queries";
import { getVisitorLocation } from "@/features/location/server";
import { formatMoney } from "@/lib/utils";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).id);
  return product
    ? { title: product.name, description: product.description.slice(0, 160) }
    : { title: "Producto no encontrado" };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { id } = await params;
  const [product, location, zones] = await Promise.all([getProduct(id), getVisitorLocation(), getPlatformZones()]);
  if (!product) notFound();
  const { business } = product;
  const state = businessOpenState(business);
  const delivery = deliveryFor(zones, location);
  const soldOut = product.stock <= 0;

  const specs = [
    { icon: Shapes, label: "Material", value: product.material },
    { icon: Ruler, label: "Medidas", value: product.dimensions },
    {
      icon: Scale,
      label: "Peso",
      value: product.weight_grams
        ? product.weight_grams >= 1000
          ? `${(product.weight_grams / 1000).toLocaleString("es-NI")} kg`
          : `${product.weight_grams} g`
        : null,
    },
  ].filter((spec) => spec.value);

  return (
    <div className="container-page py-6">
      <nav className="mb-5 flex items-center gap-1 text-sm text-muted-foreground" aria-label="Ruta">
        <Link href="/buscar" className="hover:text-primary">Explorar</Link>
        <ChevronRight className="size-4" />
        <Link href={`/negocios/${business.slug}`} className="hover:text-primary">{business.trade_name}</Link>
        <ChevronRight className="size-4" />
        <span className="truncate text-foreground">{product.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <ProductGallery images={product.images} name={product.name} icon={business.category?.icon} />

        <div>
          {product.category && <p className="text-sm font-medium text-primary">{product.category.name}</p>}
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{product.name}</h1>
          <p className="mt-3 text-3xl font-semibold tabular-nums">{formatMoney(product.price_minor)}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {soldOut ? (
              <Badge tone="red">Agotado</Badge>
            ) : product.stock <= 3 ? (
              <Badge tone="amber">Solo quedan {product.stock}</Badge>
            ) : (
              <Badge tone="green">{product.stock} disponibles</Badge>
            )}
          </div>

          <div className="mt-6">
            <AddToCartButton
              withQuantity
              disabled={soldOut}
              item={{
                productId: product.id,
                businessId: business.id,
                businessName: business.trade_name,
                businessSlug: business.slug,
                name: product.name,
                priceMinor: product.price_minor,
                image: product.images[0],
                stock: product.stock,
              }}
            />
            {!state.open && !soldOut && (
              <p className="mt-2 text-xs text-muted-foreground">
                El negocio está cerrado: puedes guardarlo en el carrito y pagar cuando abra.
              </p>
            )}
          </div>

          <p className="mt-6 leading-relaxed whitespace-pre-line text-muted-foreground">{product.description}</p>

          {specs.length > 0 && (
            <dl className="mt-6 grid gap-3 sm:grid-cols-3">
              {specs.map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl bg-muted p-3.5">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5" /> {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          )}

          <Card className="mt-6 p-4">
            <Link href={`/negocios/${business.slug}`} className="group flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Vendido por</p>
                <p className="font-semibold group-hover:text-primary">{business.trade_name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <Rating value={business.rating_avg} count={business.rating_count} />
                  <OpenBadge state={state} />
                </div>
              </div>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
            <div className="mt-4 grid gap-2 border-t pt-4 text-sm">
              {business.accepts_pickup && (
                <p className="flex items-center gap-2">
                  <Store className="size-4 text-primary" /> Retiro en el local (con tu PIN)
                </p>
              )}
              <p className="flex items-center gap-2">
                <Bike className="size-4 text-primary" />
                {delivery
                  ? `Delivery Catarina Market a tu zona: ${formatMoney(delivery.fee)}`
                  : location
                    ? "Aún no llegamos a tu zona con delivery"
                    : "Delivery Catarina Market (elige tu ubicación para ver la tarifa)"}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
