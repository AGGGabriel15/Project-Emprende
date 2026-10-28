/** Espejo del cálculo de create_order(): la comisión no aplica sobre el envío. */
export function orderTotals(subtotalMinor: number, deliveryFeeMinor: number, rate: number) {
  const commission = Math.round(subtotalMinor * rate);
  return {
    subtotal: subtotalMinor,
    delivery: deliveryFeeMinor,
    commission,
    total: subtotalMinor + deliveryFeeMinor,
    vendorNet: subtotalMinor - commission + deliveryFeeMinor,
  };
}

type Zone = { department_id: number; municipality_id: number | null; fee_minor: number; estimated_days: number };

/** Espejo de delivery_zone_for(): la zona del municipio gana a la del departamento. */
export function zoneFor<T extends Zone>(zones: T[], departmentId: number, municipalityId: number) {
  return (
    zones.find((z) => z.department_id === departmentId && z.municipality_id === municipalityId) ??
    zones.find((z) => z.department_id === departmentId && z.municipality_id === null) ??
    null
  );
}
