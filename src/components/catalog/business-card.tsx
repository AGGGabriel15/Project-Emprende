import { Bike, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  businessOpenState,
  deliveryFor,
  type BusinessWithMeta,
  type Location,
} from "@/features/catalog/meta";
import { cn, formatMoney } from "@/lib/utils";
import { OpenBadge } from "./open-badge";
import { CategoryIcon } from "./product-image";
import { Rating } from "./rating";

export function BusinessCard({
  business,
  location,
}: {
  business: BusinessWithMeta;
  location: Location;
}) {
  const state = businessOpenState(business);
  const delivery = deliveryFor(business, location);
  return (
    <Link
      href={`/negocios/${business.slug}`}
      className="group overflow-hidden rounded-(--radius-card) border bg-card transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative h-28 bg-gradient-to-br from-primary-soft to-accent-soft">
        {business.cover_url && (
          <Image
            src={business.cover_url}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, 33vw"
            className={cn("object-cover transition group-hover:scale-105", !state.open && "grayscale-[40%]")}
          />
        )}
        <div className="absolute -bottom-6 left-4 grid size-14 place-items-center overflow-hidden rounded-2xl border-4 border-card bg-card shadow-sm">
          {business.logo_url ? (
            <Image src={business.logo_url} alt="" fill sizes="56px" className="object-cover" />
          ) : (
            <CategoryIcon icon={business.category?.icon} className="size-6 text-primary" />
          )}
        </div>
      </div>
      <div className="px-4 pt-8 pb-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-sans text-base font-semibold tracking-normal group-hover:text-primary">
            {business.trade_name}
          </h3>
          <Rating value={business.rating_avg} count={business.rating_count} className="shrink-0" />
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{business.category?.name}</p>
        <OpenBadge state={state} className="mt-2" />
        <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {business.accepts_delivery && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-1",
                delivery ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground",
              )}
            >
              <Bike className="size-3.5" />
              {delivery
                ? `Delivery ${formatMoney(delivery.fee)}`
                : location
                  ? "No envía a tu zona"
                  : "Delivery"}
            </span>
          )}
          {business.accepts_pickup && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-muted-foreground">
              <Store className="size-3.5" /> Para llevar
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
