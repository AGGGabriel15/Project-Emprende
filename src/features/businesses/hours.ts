import { TIME_ZONE } from "@/lib/utils";
import type { BusinessClosure, BusinessHour } from "@/types/domain";

export const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

type LocalNow = { date: string; dow: number; minutes: number };

/** Fecha, día de la semana y minuto del día en America/Managua. */
export function localNow(at: Date = new Date()): LocalNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value]),
  );
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dow,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatTime(time: string) {
  const minutes = toMinutes(time);
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function openAtMinute(hour: BusinessHour | undefined, minutes: number) {
  if (!hour || hour.is_closed) return false;
  const opens = toMinutes(hour.opens_at);
  const closes = toMinutes(hour.closes_at);
  if (closes > opens) return minutes >= opens && minutes < closes;
  return minutes >= opens || minutes < closes;
}

export type OpenState = { open: boolean; label: string; detail?: string };

/** Espejo de public.is_business_open(), con texto para la UI. */
export function openState(
  hours: BusinessHour[],
  closures: Pick<BusinessClosure, "date">[],
  override: boolean | null,
  at: Date = new Date(),
): OpenState {
  if (override === false) return { open: false, label: "Cerrado", detail: "Cerrado temporalmente" };
  if (override === true) return { open: true, label: "Abierto" };

  const now = localNow(at);
  const closed = new Set(closures.map((c) => c.date));
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  const today = byDay.get(now.dow);

  if (!closed.has(now.date) && openAtMinute(today, now.minutes)) {
    return { open: true, label: "Abierto", detail: `Cierra a las ${formatTime(today!.closes_at)}` };
  }

  // Próxima apertura en los siguientes 7 días.
  for (let offset = 0; offset <= 7; offset++) {
    const date = addDays(now.date, offset);
    const dow = (now.dow + offset) % 7;
    const hour = byDay.get(dow);
    if (!hour || hour.is_closed || closed.has(date)) continue;
    if (offset === 0 && toMinutes(hour.opens_at) <= now.minutes) continue;
    const when =
      offset === 0 ? "" : offset === 1 ? "mañana " : `el ${DAY_NAMES[dow].toLowerCase()} `;
    return { open: false, label: "Cerrado", detail: `Abre ${when}a las ${formatTime(hour.opens_at)}` };
  }
  return { open: false, label: "Cerrado" };
}
