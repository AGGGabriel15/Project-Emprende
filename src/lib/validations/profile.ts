import { z } from "zod";
import { cedulaSchema, phoneSchema } from "./common";

export const locationSchema = z.object({
  departmentId: z.coerce
    .number({ error: "Elige un departamento." })
    .int()
    .min(1, "Elige un departamento."),
  municipalityId: z.coerce
    .number({ error: "Elige una ciudad." })
    .int()
    .min(1, "Elige una ciudad."),
});

export const profileSchema = locationSchema.extend({
  fullName: z.string().trim().min(2, "Ingresa tu nombre.").max(100),
  phone: phoneSchema,
  cedula: z.union([cedulaSchema, z.literal("")]).optional(),
});

export const addressSchema = locationSchema.extend({
  label: z.string().trim().min(2, "Ponle un nombre (Casa, Trabajo…).").max(40),
  addressLine: z
    .string()
    .trim()
    .min(10, "Incluye barrio y un punto de referencia.")
    .max(300),
  recipientName: z.string().trim().min(2, "¿Quién recibe?").max(100),
  phone: phoneSchema,
  isDefault: z.boolean().optional(),
});

export type AddressInput = z.input<typeof addressSchema>;
