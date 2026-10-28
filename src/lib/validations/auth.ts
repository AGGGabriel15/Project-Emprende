import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

export const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres.")
  .max(72)
  .regex(/[A-Za-z]/, "Incluye al menos una letra.")
  .regex(/\d/, "Incluye al menos un número.");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Ingresa tu nombre.").max(100),
  email: z.string().trim().email("Ingresa un correo válido.").max(180),
  password: passwordSchema,
  acceptTerms: z.literal(true, {
    error: "Debes aceptar los términos y el aviso de privacidad.",
  }),
});

export const resetSchema = z.object({
  email: z.string().trim().email("Ingresa un correo válido."),
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((data) => data.password === data.confirm, {
    path: ["confirm"],
    message: "Las contraseñas no coinciden.",
  });
