import { openState } from "@/features/businesses/hours";
import { zoneFor } from "@/features/checkout/pricing";
import type {
  Business,
  BusinessClosure,
  BusinessHour,
  DeliveryZone,
  PlatformCategory,
  Product,
} from "@/types/domain";

export type Location = { departmentId: number; municipalityId: number } | null;

export type BusinessWithMeta = Business & {
  category: Pick<PlatformCategory, "name" | "slug" | "icon"> | null;
  business_hours: BusinessHour[];
  business_closures: Pick<BusinessClosure, "date" | "reason">[];
  delivery_zones: DeliveryZone[];
};

export type ProductWithBusiness = Product & { business: BusinessWithMeta };

export function businessOpenState(business: BusinessWithMeta, at?: Date) {
  return openState(
    business.business_hours,
    business.business_closures,
    business.is_open_override,
    at,
  );
}

/** Cobertura de delivery para la ubicación del visitante. */
export function deliveryFor(business: BusinessWithMeta, location: Location) {
  if (!business.accepts_delivery || !location) return null;
  const zone = zoneFor(
    business.delivery_zones,
    location.departmentId,
    location.municipalityId,
  );
  return zone ? { fee: zone.fee_minor, days: zone.estimated_days } : null;
}
