import { z } from "zod";
import { phoneSchema, rucSchema } from "./common";

export const legalStepSchema = z.object({
  tradeName: z.string().trim().min(3, "Nombre comercial muy corto.").max(120),
  legalName: z
    .string()
    .trim()
    .min(3, "Ingresa la razón social o el nombre del propietario.")
    .max(160),
  personType: z.enum(["natural", "juridica"], {
    error: "Elige el tipo de persona.",
  }),
  ruc: rucSchema,
  taxRegime: z.enum(["cuota_fija", "regimen_general"], {
    error: "Elige el régimen fiscal.",
  }),
  municipalLicense: z
    .string()
    .trim()
    .min(3, "Ingresa el número de matrícula.")
    .max(60),
});

export const storeStepSchema = z.object({
  categoryId: z.coerce
    .number({ error: "Elige una categoría." })
    .int()
    .min(1, "Elige una categoría."),
  description: z
    .string()
    .trim()
    .min(30, "Cuéntanos un poco más (mínimo 30 caracteres).")
    .max(1000),
  departmentId: z.coerce.number().int().min(1, "Elige un departamento."),
  municipalityId: z.coerce.number().int().min(1, "Elige una ciudad."),
  addressLine: z.string().trim().min(10, "Incluye una referencia.").max(300),
  phone: phoneSchema,
  whatsapp: z.union([phoneSchema, z.literal("")]).optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  coverUrl: z.string().url().optional().or(z.literal("")),
});

export const bankStepSchema = z.object({
  bankName: z.string().trim().min(2, "Elige el banco."),
  accountType: z.enum(["ahorro", "corriente"]),
  currency: z.enum(["NIO", "USD"]),
  accountNumber: z
    .string()
    .trim()
    .regex(/^\d{6,20}$/, "Solo dígitos (6 a 20)."),
  accountHolder: z.string().trim().min(3, "Nombre del titular.").max(160),
});

export const businessSettingsSchema = storeStepSchema.extend({
  tradeName: legalStepSchema.shape.tradeName,
});

export const BANKS = [
  "BANPRO",
  "LAFISE Bancentro",
  "BAC Credomatic",
  "Banco Ficohsa",
  "BDF",
  "Avanz",
];

export const REQUIRED_DOCUMENTS = [
  { type: "ruc", label: "Constancia de RUC (DGI)" },
  { type: "cedula_front", label: "Cédula · frente" },
  { type: "cedula_back", label: "Cédula · reverso" },
  { type: "municipal_license", label: "Matrícula de la Alcaldía" },
] as const;
