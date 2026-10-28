import { z } from "zod";
import { formatCedula, normalizePhone } from "@/lib/phone";

// Teléfono en E.164. Sin prefijo se asume Nicaragua (+505); acepta otros países.
export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Ingresa un teléfono.")
  .transform((value, ctx) => {
    const phone = normalizePhone(value);
    if (!phone) {
      ctx.addIssue({ code: "custom", message: "Ingresa un teléfono válido." });
      return z.NEVER;
    }
    return phone;
  });

// Cédula: 001-010190-0001A (13 dígitos + letra). Se guarda con guiones.
export const cedulaSchema = z
  .string()
  .trim()
  .transform(formatCedula)
  .refine(
    (value) => /^\d{3}-\d{6}-\d{4}[A-Z]$/.test(value),
    "Formato de cédula: 001-010190-0001A.",
  );

// RUC de la DGI: 14 caracteres (J + 13 dígitos, o la cédula sin guiones).
export const rucSchema = z
  .string()
  .trim()
  .toUpperCase()
  .transform((value) => value.replace(/[\s-]/g, ""))
  .refine(
    (value) => /^(J\d{13}|\d{13}[A-Z])$/.test(value),
    "El RUC debe tener 14 caracteres (p. ej. J0310000000001).",
  );

export const moneySchema = z.coerce
  .number({ error: "Ingresa un monto." })
  .min(0, "No puede ser negativo.")
  .max(1_000_000, "Monto demasiado alto.");
