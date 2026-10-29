import { z } from "zod";
import { phoneSchema, rucSchema } from "./common";

const formalFields = {
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
};

const identityFields = {
  tradeName: z.string().trim().min(3, "Nombre comercial muy corto.").max(120),
  legalName: z
    .string()
    .trim()
    .min(3, "Ingresa el nombre completo como aparece en la cédula.")
    .max(160),
};

/** Paso 1: el nivel decide qué se pide. Informal = sin RUC ni matrícula. */
export const legalStepSchema = z.discriminatedUnion("tier", [
  z.object({ tier: z.literal("informal"), ...identityFields }),
  z.object({ tier: z.literal("formal"), ...identityFields, ...formalFields }),
]);

/** Formalización de un emprendedor ya aprobado. */
export const formalUpgradeSchema = z.object(formalFields);

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
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
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

export const businessSettingsSchema = storeStepSchema
  .omit({ latitude: true, longitude: true })
  .extend({ tradeName: identityFields.tradeName });

export const BANKS = [
  "BANPRO",
  "LAFISE Bancentro",
  "BAC Credomatic",
  "Banco Ficohsa",
  "BDF",
  "Avanz",
];

export const TIER_INFO = {
  informal: {
    label: "Emprendedor verificado",
    short: "Vendo desde mi casa o taller (sin RUC)",
    badge: "Identidad y visita verificadas",
  },
  formal: {
    label: "Negocio formal",
    short: "Tengo RUC (DGI) y matrícula de la Alcaldía",
    badge: "RUC y matrícula verificados",
  },
} as const;

/** Documentos exigidos por nivel (deben coincidir con submit_business_application). */
export const REQUIRED_DOCUMENTS = {
  informal: [
    { type: "cedula_front", label: "Cédula · frente", hint: "Foto clara, sin reflejos." },
    { type: "cedula_back", label: "Cédula · reverso" },
    { type: "selfie_cedula", label: "Selfie sosteniendo tu cédula", hint: "Tu cara y la cédula deben verse bien." },
    { type: "place_photo_1", label: "Foto del lugar donde trabajas", hint: "Fachada o entrada de tu casa/taller." },
    { type: "place_photo_2", label: "Foto de tus productos en el lugar", hint: "Plantas, piezas o taller tal como están." },
  ],
  formal: [
    { type: "ruc", label: "Constancia de RUC (DGI)" },
    { type: "cedula_front", label: "Cédula del representante · frente" },
    { type: "cedula_back", label: "Cédula del representante · reverso" },
    { type: "municipal_license", label: "Matrícula de la Alcaldía" },
  ],
} as const satisfies Record<string, readonly { type: string; label: string; hint?: string }[]>;

export const UPGRADE_DOCUMENTS = [
  { type: "ruc", label: "Constancia de RUC (DGI)" },
  { type: "municipal_license", label: "Matrícula de la Alcaldía" },
] as const;
