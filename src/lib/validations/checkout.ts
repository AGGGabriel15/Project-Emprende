import { z } from "zod";
import { phoneSchema } from "./common";

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
  note: z.string().trim().max(200).optional(),
});

export const checkoutSchema = z
  .object({
    businessId: z.string().uuid(),
    serviceType: z.enum(["delivery", "pickup"]),
    addressId: z.string().uuid().optional(),
    items: z.array(cartLineSchema).min(1, "El carrito está vacío.").max(50),
    contactName: z
      .string()
      .trim()
      .min(2, "Ingresa el nombre de contacto.")
      .max(100),
    contactPhone: phoneSchema,
    note: z.string().trim().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.serviceType === "delivery" && !data.addressId) {
      ctx.addIssue({
        code: "custom",
        path: ["addressId"],
        message: "Elige la dirección de entrega.",
      });
    }
  });

export type CheckoutInput = z.input<typeof checkoutSchema>;
