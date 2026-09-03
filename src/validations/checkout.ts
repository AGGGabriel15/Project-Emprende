import { z } from "zod";

export const checkoutSchema = z
  .object({
    items: z
      .array(
        z.object({
          productId: z.string().regex(/^[a-f\d]{24}$/i),
          quantity: z.number().int().min(1).max(99),
        }),
      )
      .min(1)
      .max(30),
    contactName: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(7).max(30),
    fulfillmentMethod: z.enum(["pickup", "delivery"]),
    deliveryAddress: z.string().trim().max(300).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentMethod === "delivery" && !data.deliveryAddress) {
      ctx.addIssue({
        code: "custom",
        path: ["deliveryAddress"],
        message: "La dirección es obligatoria para entrega.",
      });
    }
  });
