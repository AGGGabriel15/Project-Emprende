/// <reference types="jest" />
/**
 * La app reutiliza módulos puros del web (../src). Estas pruebas confirman que
 * se resuelven con la configuración de la app y dan los mismos resultados.
 */
import { localNow, openState } from '@/features/businesses/hours';
import { zoneFor } from '@/features/checkout/pricing';
import { courierStage } from '@/features/couriers/status';
import { showsPin, timelineSteps } from '@/features/orders/status';
import { formatMoney } from '@/lib/format';
import { formatPhone, normalizePhone } from '@/lib/phone';
import { needsProfileCompletion } from '@/lib/roles';
import { checkoutSchema } from '@/lib/validations/checkout';
import type { BusinessHour, PlatformZone } from '@/types/domain';
import { fieldErrors, safeNext } from '~/lib/forms';

describe('módulos compartidos con el web', () => {
  it('usa la hora de Managua (UTC-6)', () => {
    const now = localNow(new Date(Date.UTC(2026, 9, 26, 16, 0)));
    expect(now).toEqual({ date: '2026-10-26', dow: 1, minutes: 600 });
  });

  it('calcula si un negocio está abierto', () => {
    const week: BusinessHour[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      business_id: 'b',
      day_of_week: day,
      opens_at: '08:00',
      closes_at: '17:00',
      is_closed: day === 0,
    }));
    expect(openState(week, [], null, new Date(Date.UTC(2026, 9, 26, 16, 0))).open).toBe(true);
    expect(openState(week, [], false, new Date(Date.UTC(2026, 9, 26, 16, 0))).open).toBe(false);
  });

  it('elige la zona de delivery más específica', () => {
    const zones = [
      { id: 1, department_id: 10, municipality_id: null, fee_minor: 15000, estimated_days: 1, is_active: true },
      { id: 2, department_id: 10, municipality_id: 101, fee_minor: 8000, estimated_days: 0, is_active: true },
    ] as unknown as PlatformZone[];
    expect(zoneFor(zones, 10, 101)?.fee_minor).toBe(8000);
    expect(zoneFor(zones, 10, 999)?.fee_minor).toBe(15000);
    expect(zoneFor(zones, 11, 1)).toBeFalsy();
  });

  it('comparte estados de pedidos y envíos', () => {
    expect(showsPin('on_the_way')).toBe(true);
    expect(showsPin('completed')).toBe(false);
    expect(timelineSteps('pickup')).toContain('ready_for_pickup');
    expect(courierStage('at_dropoff')).toBe('at_dropoff');
  });

  it('valida y formatea teléfonos de Nicaragua', () => {
    expect(normalizePhone('8453 7341')).toBe('+50584537341');
    expect(formatPhone('+50584537341')).toBe('+505 8453 7341');
    expect(normalizePhone('123')).toBeNull();
  });

  it('valida el checkout con los mismos mensajes', () => {
    const result = checkoutSchema.safeParse({ businessId: crypto.randomUUID(), serviceType: 'delivery', items: [{ productId: crypto.randomUUID(), quantity: 1 }], contactName: 'Ana', contactPhone: '84537341' });
    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).addressId).toBe('Elige la dirección de entrega.');
  });

  it('formatea córdobas y pide completar el perfil', () => {
    expect(formatMoney(25000)).toContain('250');
    expect(needsProfileCompletion({ role: 'courier', phone: '+50584537341', department_id: null })).toBe(false);
    expect(needsProfileCompletion({ role: 'customer', phone: '+50584537341', department_id: null })).toBe(true);
  });

  it('solo vuelve a rutas internas tras el login', () => {
    expect(safeNext('/vendedor/solicitud')).toBe('/vendedor/solicitud');
    expect(safeNext('//evil.com')).toBe('/');
    expect(safeNext('https://evil.com')).toBe('/');
  });
});
