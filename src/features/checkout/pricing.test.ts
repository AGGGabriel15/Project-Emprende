import { describe, expect, it } from "vitest";
import { orderTotals, platformMargin, zoneFor } from "./pricing";

describe("desglose del pedido", () => {
  it("el negocio recibe productos menos comisión; envío y servicio son de la plataforma", () => {
    const totals = orderTotals(100_000, 8_000, 0.08, 1_500);
    expect(totals.commission).toBe(8_000);
    expect(totals.total).toBe(109_500);
    expect(totals.vendorNet).toBe(92_000);
  });

  it("ejemplo del modelo: C$600 a Managua deja ≈ C$66 a la plataforma", () => {
    const margin = platformMargin({
      subtotal: 60_000,
      deliveryFee: 12_000,
      serviceFee: 1_500,
      courierCost: 9_000,
      rate: 0.1,
      gatewayRate: 0.039,
      reserveRate: 0.015,
    });
    expect(margin.total).toBe(73_500);
    expect(margin.vendorNet).toBe(54_000);
    expect(margin.gateway).toBe(2_867);
    expect(margin.net).toBe(6_000 + 3_000 + 1_500 - 2_867 - 900);
  });

  it("redondea la comisión al centavo", () => {
    expect(orderTotals(12_345, 0, 0.08).commission).toBe(988);
  });

  it("Para llevar no suma envío", () => {
    expect(orderTotals(50_000, 0, 0.08).total).toBe(50_000);
  });
});

describe("cobertura de delivery", () => {
  const zones = [
    { department_id: 11, municipality_id: null, fee_minor: 5_000, estimated_days: 0 },
    { department_id: 11, municipality_id: 84, fee_minor: 2_000, estimated_days: 0 },
    { department_id: 10, municipality_id: null, fee_minor: 10_000, estimated_days: 1 },
  ];

  it("la tarifa del municipio gana a la del departamento", () => {
    expect(zoneFor(zones, 11, 84)?.fee_minor).toBe(2_000);
    expect(zoneFor(zones, 11, 87)?.fee_minor).toBe(5_000);
  });

  it("sin tarifa no hay cobertura", () => {
    expect(zoneFor(zones, 8, 60)).toBeNull();
  });
});
