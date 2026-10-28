import { describe, expect, it } from "vitest";
import { periodRange, salesSeries, summarize, topProducts, type ReportOrder } from "./compute";

const order = (status: ReportOrder["status"], subtotal: number, paidAt: string | null, items: ReportOrder["items"] = []): ReportOrder => ({
  id: crypto.randomUUID(),
  status,
  business_id: "b",
  subtotal_minor: subtotal,
  delivery_fee_minor: 1_000,
  commission_amount_minor: Math.round(subtotal * 0.08),
  total_minor: subtotal + 1_000,
  vendor_net_minor: subtotal - Math.round(subtotal * 0.08) + 1_000,
  paid_at: paidAt,
  created_at: paidAt ?? "2026-10-01T12:00:00Z",
  items,
});

describe("reportes", () => {
  const orders = [
    order("completed", 10_000, "2026-10-20T18:00:00Z", [{ product_id: "p1", product_name: "Jarrón", quantity: 2, subtotal_minor: 10_000 }]),
    order("preparing", 5_000, "2026-10-21T18:00:00Z", [{ product_id: "p2", product_name: "Helecho", quantity: 1, subtotal_minor: 5_000 }]),
    order("refunded", 7_000, "2026-10-21T19:00:00Z"),
    order("cancelled", 3_000, null),
  ];

  it("no cuenta cancelados/reembolsados como venta ni pedidos sin pagar", () => {
    const s = summarize(orders);
    expect(s.orders).toBe(2);
    expect(s.gross).toBe(15_000);
    expect(s.commission).toBe(1_200);
    expect(s.cancelled).toBe(1);
    expect(s.cancellationRate).toBeCloseTo(1 / 3);
    expect(s.avgTicket).toBe(8_500);
  });

  it("arma la serie diaria con días vacíos", () => {
    const series = salesSeries(orders, "2026-10-19", "2026-10-21", "day");
    expect(series.map((p) => p.sales)).toEqual([0, 10_000, 5_000]);
  });

  it("ordena los productos más vendidos por ingresos", () => {
    expect(topProducts(orders).map((p) => p.name)).toEqual(["Jarrón", "Helecho"]);
  });

  it("elige la granularidad según el período", () => {
    expect(periodRange("7d", "2026-10-27")).toMatchObject({ from: "2026-10-21", granularity: "day" });
    expect(periodRange("365d", "2026-10-27").granularity).toBe("month");
  });
});
