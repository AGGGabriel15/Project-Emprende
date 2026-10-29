import { openState } from "@/features/businesses/hours";
import { zoneFor } from "@/features/checkout/pricing";
import type {
  Business,
  BusinessClosure,
  BusinessHour,
  PlatformCategory,
  PlatformZone,
  Product,
} from "@/types/domain";

export type Location = { departmentId: number; municipalityId: number } | null;

export type BusinessWithMeta = Business & {
  category: Pick<PlatformCategory, "name" | "slug" | "icon"> | null;
  business_hours: BusinessHour[];
  business_closures: Pick<BusinessClosure, "date" | "reason">[];
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

export type DeliveryQuote = { fee: number; days: number } | null;

/** Cobertura del delivery de la plataforma (igual para todos los negocios). */
export function deliveryFor(zones: PlatformZone[], location: Location): DeliveryQuote {
  if (!location) return null;
  const zone = zoneFor(zones, location.departmentId, location.municipalityId);
  return zone ? { fee: zone.fee_minor, days: zone.estimated_days } : null;
}
