import { z } from "zod";

export const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(180),
    password: z.string().min(8).max(72),
    role: z.enum(["cliente", "emprendedor"]),
    businessName: z.string().trim().max(120).optional(),
    description: z.string().trim().max(800).optional(),
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(250).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.role !== "emprendedor") return;
    for (const field of [
      "businessName",
      "description",
      "phone",
      "address",
    ] as const) {
      if (!data[field] || data[field].length < 2) {
        ctx.addIssue({
          code: "custom",
          path: [field],
          message: "Este campo es obligatorio para emprendedores.",
        });
      }
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});
