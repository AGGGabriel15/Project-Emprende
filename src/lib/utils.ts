import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const TIME_ZONE = "America/Managua";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amountMinor: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "currency",
    currency: "NIO",
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function formatDate(value: string | Date, withTime = true) {
  return new Intl.DateTimeFormat("es-NI", {
    dateStyle: "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: TIME_ZONE,
  }).format(new Date(value));
}

export function formatPercent(rate: number) {
  return new Intl.NumberFormat("es-NI", {
    style: "percent",
    maximumFractionDigits: 2,
  }).format(rate);
}

export function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function toMinor(amount: number) {
  return Math.round(amount * 100);
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

/** Mensaje legible de un error de Supabase/Postgres (las funciones SQL lanzan textos en español). */
export function errorMessage(error: unknown, fallback = "Ocurrió un error inesperado.") {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (message && !message.startsWith("JWT") && message.length < 300) return message;
  }
  return fallback;
}
