import { z } from "zod";
import { moneySchema } from "./common";

export const productSchema = z.object({
  name: z.string().trim().min(3, "Nombre muy corto.").max(120),
  description: z
    .string()
    .trim()
    .min(10, "Describe el producto (mínimo 10 caracteres).")
    .max(2000),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  material: z.string().trim().max(120).optional(),
  dimensions: z.string().trim().max(120).optional(),
  weightGrams: z.coerce.number().int().min(0).max(1_000_000).optional(),
  price: moneySchema.refine((value) => value > 0, "El precio debe ser mayor que 0."),
  stock: z.coerce
    .number({ error: "Ingresa el stock." })
    .int("Solo números enteros.")
    .min(0, "No puede ser negativo.")
    .max(100_000),
  isActive: z.boolean(),
  images: z.array(z.string().url()).max(6, "Máximo 6 fotos."),
});

export type ProductInput = z.input<typeof productSchema>;

export const productCategorySchema = z.object({
  name: z.string().trim().min(2, "Nombre muy corto.").max(60),
});

export const hoursSchema = z
  .array(
    z.object({
      dayOfWeek: z.number().int().min(0).max(6),
      opensAt: z.string().regex(/^\d{2}:\d{2}/),
      closesAt: z.string().regex(/^\d{2}:\d{2}/),
      isClosed: z.boolean(),
    }),
  )
  .length(7);

export const closureSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  reason: z.string().trim().min(3, "Indica el motivo.").max(120),
});

