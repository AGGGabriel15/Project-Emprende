/**
 * Espejo de create_order(): el negocio recibe los productos menos la comisión;
 * el envío y la tarifa de servicio son de la plataforma (ella paga a sus repartidores).
 */
export function orderTotals(subtotalMinor: number, deliveryFeeMinor: number, rate: number, serviceFeeMinor = 0) {
  const commission = Math.round(subtotalMinor * rate);
  return {
    subtotal: subtotalMinor,
    delivery: deliveryFeeMinor,
    service: serviceFeeMinor,
    commission,
    total: subtotalMinor + deliveryFeeMinor + serviceFeeMinor,
    vendorNet: subtotalMinor - commission,
  };
}

/** Ganancia estimada de la plataforma en un pedido completado (ver platform_profit en SQL). */
export function platformMargin(input: {
  subtotal: number;
  deliveryFee: number;
  serviceFee: number;
  courierCost: number;
  rate: number;
  gatewayRate: number;
  reserveRate: number;
}) {
  const totals = orderTotals(input.subtotal, input.deliveryFee, input.rate, input.serviceFee);
  const gateway = Math.round(totals.total * input.gatewayRate);
  const reserve = Math.round(input.subtotal * input.reserveRate);
  const net = totals.commission + input.deliveryFee - input.courierCost + input.serviceFee - gateway - reserve;
  return { ...totals, gateway, reserve, net };
}

type Zone = { department_id: number; municipality_id: number | null; fee_minor: number; estimated_days: number };

/** Espejo de platform_zone_for(): la zona del municipio gana a la del departamento. */
export function zoneFor<T extends Zone>(zones: T[], departmentId: number, municipalityId: number) {
  return (
    zones.find((z) => z.department_id === departmentId && z.municipality_id === municipalityId) ??
    zones.find((z) => z.department_id === departmentId && z.municipality_id === null) ??
    null
  );
}
