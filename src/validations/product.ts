import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(1500),
  categoryId: z.string().regex(/^[a-f\d]{24}$/i, "Categoría inválida."),
  price: z.number().positive().max(1_000_000),
  stock: z.number().int().min(0).max(100_000),
  images: z.array(z.string().startsWith("/uploads/")).max(5),
  active: z.boolean().optional(),
});
