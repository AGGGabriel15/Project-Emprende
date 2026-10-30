import { BadgeCheck, Bike, Clock, MapPin, MessageCircle, PackageOpen, Phone, Store } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { OpenBadge } from "@/components/catalog/open-badge";
import { ProductCard } from "@/components/catalog/product-card";
import { CategoryIcon } from "@/components/catalog/product-image";
import { Rating } from "@/components/catalog/rating";
import { ReviewItem } from "@/components/catalog/review-item";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { DAY_NAMES, formatTime, localNow } from "@/features/businesses/hours";
import { businessOpenState, deliveryFor } from "@/features/catalog/meta";
import { getBusinessBySlug, getBusinessStats, getPlatformZones } from "@/features/catalog/queries";
import { getGeo, getVisitorLocation, placeName } from "@/features/location/server";
import { getSession, requireBusinessViewer } from "@/lib/auth";
import { canShop } from "@/lib/roles";
import { TIER_INFO } from "@/lib/validations/business";
import { cn, formatDate, formatMoney, formatPercent } from "@/lib/utils";
import { formatPhone, phoneHref, whatsappHref } from "@/lib/phone";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const data = await getBusinessBySlug((await params).slug);
  return data
    ? { title: data.business.trade_name, description: data.business.description.slice(0, 160) }
    : { title: "Negocio no encontrado" };
}

export default async function BusinessPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [data, location, geo, session, zones] = await Promise.all([
    getBusinessBySlug(slug),
    getVisitorLocation(),
    getGeo(),
    getSession(),
    getPlatformZones(),
  ]);
  if (!data || data.business.status !== "approved") notFound();
  await requireBusinessViewer(data.business.owner_id);
  const { business, products, categories, reviews } = data;
  const stats = await getBusinessStats(business.id);
  const state = businessOpenState(business);
  const delivery = deliveryFor(zones, location);
  const today = localNow().dow;

  const sections = [
    ...categories.map((c) => ({ id: c.id, name: c.name, items: products.filter((p) => p.category_id === c.id) })),
    { id: "otros", name: categories.length ? "Otros" : "Productos", items: products.filter((p) => !p.category_id || !categories.some((c) => c.id === p.category_id)) },
  ].filter((s) => s.items.length);

  return (
    <div>
      <div className="relative h-44 bg-gradient-to-br from-primary-soft to-accent-soft sm:h-60">
        {business.cover_url && (
          <Image src={business.cover_url} alt="" fill priority sizes="100vw" className="object-cover" />
        )}
      </div>
      <div className="container-page">
        {/* Solo el logo se monta sobre la portada; el nombre queda siempre debajo, legible. */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-5">
          <div className="relative -mt-12 grid size-24 shrink-0 place-items-center overflow-hidden rounded-3xl border-4 border-background bg-card shadow-md sm:-mt-14 sm:size-28">
            {business.logo_url ? (
              <Image src={business.logo_url} alt={`Logo de ${business.trade_name}`} fill sizes="112px" className="object-cover" />
            ) : (
              <CategoryIcon icon={business.category?.icon} className="size-10 text-primary" />
            )}
          </div>
          <div className="min-w-0 flex-1 sm:pt-4">
            <h1 className="text-3xl font-semibold leading-tight">{business.trade_name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="text-muted-foreground">{business.category?.name}</span>
              <Rating value={business.rating_avg} count={business.rating_count} />
              <OpenBadge state={state} />
              <span
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary"
                title={TIER_INFO[business.tier].badge}
              >
                <BadgeCheck className="size-3.5" /> {TIER_INFO[business.tier].label}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {stats.completedOrders} {stats.completedOrders === 1 ? "pedido entregado" : "pedidos entregados"}
              {stats.onTimeRate !== null && ` · ${formatPercent(stats.onTimeRate)} preparados a tiempo`}
              {stats.memberSince && ` · en Catarina Market desde ${formatDate(stats.memberSince, false)}`}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="min-w-0">
            {business.description && (
              <p className="max-w-3xl leading-relaxed text-muted-foreground">{business.description}</p>
            )}
            {!state.open && (
              <div className="mt-5 flex items-start gap-3 rounded-2xl bg-warning-soft p-4 text-sm">
                <Clock className="mt-0.5 size-4 shrink-0 text-warning" />
                <p>
                  <strong>El negocio está cerrado.</strong>{" "}
                  {canShop(session?.profile.role)
                    ? "Puedes agregar productos al carrito, pero el pago se habilita cuando abra"
                    : "Abre de nuevo"}
                  {state.detail ? ` (${state.detail.toLowerCase().replace(/\.$/, "")})` : ""}.
                </p>
              </div>
            )}

            {sections.length > 1 && (
              <nav className="scrollbar-none sticky top-[7rem] z-10 -mx-4 mt-6 flex gap-2 overflow-x-auto bg-background/95 px-4 py-2 backdrop-blur md:top-16">
                {sections.map((section) => (
                  <a
                    key={section.id}
                    href={`#cat-${section.id}`}
                    className="shrink-0 rounded-full border bg-card px-3.5 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
                  >
                    {section.name}
                  </a>
                ))}
              </nav>
            )}

            {sections.length === 0 ? (
              <EmptyState
                className="mt-6"
                icon={<PackageOpen />}
                title="Este negocio aún no publica productos"
                description="Vuelve pronto: están preparando su catálogo."
              />
            ) : (
              sections.map((section) => (
                <section key={section.id} id={`cat-${section.id}`} className="mt-8 scroll-mt-40">
                  <h2 className="mb-4 text-xl font-semibold">{section.name}</h2>
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3">
                    {section.items.map((product) => (
                      <ProductCard key={product.id} product={product} business={business} showBusiness={false} />
                    ))}
                  </div>
                </section>
              ))
            )}

            {reviews.length > 0 && (
              <section className="mt-12">
                <h2 className="mb-4 text-xl font-semibold">Reseñas de clientes</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {reviews.map((review) => (
                    <Card key={review.id} className="p-4">
                      <ReviewItem review={review} />
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
            <Card className="p-5">
              <h2 className="font-sans text-sm font-semibold tracking-normal">Formas de entrega</h2>
              <ul className="mt-3 space-y-3 text-sm">
                {business.accepts_pickup && (
                  <li className="flex gap-3">
                    <Store className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <strong className="block">Retiro en el local</strong>
                      <span className="text-muted-foreground">Sin costo de envío. Entregas tu PIN al recogerlo.</span>
                    </span>
                  </li>
                )}
                  <li className="flex gap-3">
                    <Bike className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>
                      <strong className="block">Delivery Catarina Market</strong>
                      {delivery ? (
                        <span className="text-muted-foreground">
                          A {placeName(geo, location?.municipalityId)}: {formatMoney(delivery.fee)} ·{" "}
                          {delivery.days === 0 ? "el mismo día" : `${delivery.days} ${delivery.days === 1 ? "día" : "días"}`}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {location ? "Aún no llegamos a tu zona." : "Elige tu ubicación para ver la tarifa."}
                        </span>
                      )}
                    </span>
                  </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Recogemos el pedido en el negocio, lo revisamos y te lo entregamos con tu PIN. Tu pago se libera al
                negocio solo después de la entrega.
              </p>
              {zones.length > 0 && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer font-medium text-primary">
                    Ver zonas de envío ({zones.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-muted-foreground">
                    {zones.map((zone) => (
                      <li key={zone.id} className="flex justify-between gap-2">
                        <span>
                          {zone.municipality_id
                            ? placeName(geo, zone.municipality_id)
                            : geo.departments.find((d) => d.id === zone.department_id)?.name}
                        </span>
                        <span className="tabular-nums">{formatMoney(zone.fee_minor)}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-sans text-sm font-semibold tracking-normal">Horario</h2>
              <ul className="mt-3 space-y-1.5 text-sm">
                {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                  const hour = business.business_hours.find((h) => h.day_of_week === dow);
                  return (
                    <li key={dow} className={cn("flex justify-between", dow === today && "font-semibold text-foreground")}>
                      <span>{DAY_NAMES[dow]}</span>
                      <span className={cn(dow !== today && "text-muted-foreground")}>
                        {!hour || hour.is_closed ? "Cerrado" : `${formatTime(hour.opens_at)} – ${formatTime(hour.closes_at)}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {business.business_closures.length > 0 && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {business.business_closures.slice(0, 3).map((closure) => (
                    <p key={closure.date} className="text-xs">
                      <Badge tone="amber">Cerrado {formatDate(`${closure.date}T12:00:00`, false)}</Badge>{" "}
                      <span className="text-muted-foreground">{closure.reason}</span>
                    </p>
                  ))}
                </div>
              )}
            </Card>

            <Card className="space-y-3 p-5 text-sm">
              {business.address_line && (
                <p className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span>
                    {business.address_line}
                    <span className="block text-muted-foreground">{placeName(geo, business.municipality_id)}</span>
                  </span>
                </p>
              )}
              {business.phone && (
                <a href={phoneHref(business.phone)} className="flex gap-3 hover:text-primary">
                  <Phone className="size-4 text-muted-foreground" /> {formatPhone(business.phone)}
                </a>
              )}
              {business.whatsapp && (
                <a
                  href={whatsappHref(business.whatsapp)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex gap-3 hover:text-primary"
                >
                  <MessageCircle className="size-4 text-muted-foreground" /> Escribir por WhatsApp
                </a>
              )}
            </Card>
          </aside>
        </div>
      </div>
    </div>
  );
}
