import { describe, expect, it } from "vitest";
import { orderTotals, zoneFor } from "./pricing";

describe("desglose del pedido", () => {
  it("la comisión se cobra solo sobre el subtotal; el envío pasa íntegro al negocio", () => {
    const totals = orderTotals(100_000, 8_000, 0.08);
    expect(totals.commission).toBe(8_000);
    expect(totals.total).toBe(108_000);
    expect(totals.vendorNet).toBe(100_000 - 8_000 + 8_000);
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
