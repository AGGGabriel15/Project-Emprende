import { deliveryFor, type Location } from '@/features/catalog/meta';
import { useSession } from '~/features/auth/session';
import { usePlatformZones } from '~/features/catalog/queries';
import { useVisitorLocation } from './geo';

/** Ubicación activa (la elegida en la app o la del perfil) y su tarifa de delivery. */
export function useDelivery() {
  const { profile } = useSession();
  const visitor = useVisitorLocation((s) => s.location);
  const zones = usePlatformZones();
  const location: Location =
    visitor ??
    (profile?.department_id && profile.municipality_id
      ? { departmentId: profile.department_id, municipalityId: profile.municipality_id }
      : null);
  return { location, delivery: deliveryFor(zones.data ?? [], location), zones: zones.data ?? [] };
}
