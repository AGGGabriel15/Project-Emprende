import { describe, expect, it } from "vitest";
import type { BusinessHour } from "@/types/domain";
import { localNow, openState } from "./hours";

const week = (opens = "08:00", closes = "17:00"): BusinessHour[] =>
  [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    business_id: "b",
    day_of_week: day,
    opens_at: opens,
    closes_at: closes,
    is_closed: day === 0,
  }));

// Managua es UTC-6 todo el año: 16:00Z = 10:00 local.
const mondayAt = (localHour: number) =>
  new Date(Date.UTC(2026, 9, 26, localHour + 6, 0));

describe("horario en America/Managua", () => {
  it("convierte la hora a la zona local", () => {
    const now = localNow(mondayAt(10));
    expect(now.dow).toBe(1);
    expect(now.minutes).toBe(600);
    expect(now.date).toBe("2026-10-26");
  });

  it("abierto dentro del horario, cerrado fuera", () => {
    expect(openState(week(), [], null, mondayAt(10)).open).toBe(true);
    const closed = openState(week(), [], null, mondayAt(7));
    expect(closed.open).toBe(false);
    expect(closed.detail).toBe("Abre a las 8:00 a. m.");
  });

  it("después del cierre indica que abre mañana", () => {
    expect(openState(week(), [], null, mondayAt(18)).detail).toBe("Abre mañana a las 8:00 a. m.");
  });

  it("respeta los cierres especiales y el interruptor manual", () => {
    expect(openState(week(), [{ date: "2026-10-26" }], null, mondayAt(10)).open).toBe(false);
    expect(openState(week(), [], false, mondayAt(10)).open).toBe(false);
    expect(openState(week(), [], true, mondayAt(3)).open).toBe(true);
  });

  it("soporta horarios que cruzan la medianoche", () => {
    expect(openState(week("18:00", "02:00"), [], null, mondayAt(23)).open).toBe(true);
    expect(openState(week("18:00", "02:00"), [], null, mondayAt(12)).open).toBe(false);
  });

  it("salta los días cerrados al buscar la próxima apertura", () => {
    const saturdayNight = new Date(Date.UTC(2026, 9, 25, 4, 0)); // sábado 22:00 local
    expect(openState(week(), [], null, saturdayNight).detail).toBe("Abre el lunes a las 8:00 a. m.");
  });
});
