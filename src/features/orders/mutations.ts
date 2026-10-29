import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { failure, invalid, success } from "@/lib/actions";

/**
 * Acciones sobre pedidos compartidas por las Server Actions del web y la app
 * móvil. Reciben el cliente de Supabase del usuario: las reglas están en las
 * funciones de la base (rpc) y RLS. Los reembolsos los procesa quien llama.
 */

const reviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function submitReviewWith(supabase: SupabaseClient, userId: string, input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data: order } = await supabase.from("orders").select("business_id").eq("id", parsed.data.orderId).single();
  const { error } = await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    business_id: order?.business_id,
    customer_id: userId,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });
  if (error) {
    return failure(error.code === "23505" ? { message: "Ya calificaste este pedido." } : error);
  }
  return success();
}

const deliveryRatingSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5),
  tags: z.array(z.string()).max(6).default([]),
  comment: z.string().trim().max(500).optional(),
});

/** Calificación del repartidor (independiente de la reseña del negocio). */
export async function rateDeliveryWith(supabase: SupabaseClient, input: unknown) {
  const parsed = deliveryRatingSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await supabase.rpc("rate_delivery", {
    p_order: parsed.data.orderId,
    p_rating: parsed.data.rating,
    p_tags: parsed.data.tags,
    p_comment: parsed.data.comment ?? "",
  });
  if (error) return failure(error);
  return success();
}

const PIN_MESSAGES: Record<string, string> = {
  wrong_pin: "PIN incorrecto. Pídele al cliente el código de 4 dígitos de su pedido.",
  locked: "Demasiados intentos con PIN incorrecto. Contacta a la administración.",
  invalid: "El pedido no tiene PIN.",
};

export const evidencePath = z.string().min(5).max(300);

/** El negocio marca "listo" con la foto del pedido empacado (evidencia para la recolección). */
export async function markOrderReadyWith(supabase: SupabaseClient, orderId: string, photoPath: string) {
  if (!z.string().uuid().safeParse(orderId).success || !evidencePath.safeParse(photoPath).success) {
    return failure({ message: "Sube la foto del pedido empacado." });
  }
  const { error } = await supabase.rpc("mark_order_ready", { p_order: orderId, p_photo_path: photoPath });
  if (error) return failure(error);
  return success();
}

/** Retiro en el negocio: se entrega solo con el PIN del cliente. */
export async function completeWithPinWith(supabase: SupabaseClient, orderId: string, pin: string) {
  if (!/^\d{4}$/.test(pin.trim())) return failure({ message: "El PIN tiene 4 dígitos." });
  const { data, error } = await supabase.rpc("complete_with_pin", { p_order: orderId, p_pin: pin.trim() });
  if (error) return failure(error);
  if (data !== "ok") return failure({ message: PIN_MESSAGES[data as string] ?? "No se pudo confirmar la entrega." });
  return success();
}

const cancelSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres).").max(300),
});

/**
 * Cancela con motivo (repone stock y deja el reembolso total en cola).
 * Si cancela el negocio, la base registra una falta. `queued`: hay reembolso por procesar.
 */
export async function cancelOrderWith(supabase: SupabaseClient, input: unknown) {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { data: queued, error } = await supabase.rpc("cancel_order", {
    p_order: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error);
  return success({ orderId: parsed.data.orderId, queued: Boolean(queued) });
}

const claimSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.enum(["not_received", "damaged", "wrong_item", "missing_items", "other"]),
  description: z.string().trim().min(10, "Cuéntanos qué pasó (mínimo 10 caracteres).").max(1000),
  photos: z.array(evidencePath).max(4),
});

/** El cliente reporta un problema dentro de las 48 h siguientes a la entrega. */
export async function openClaimWith(supabase: SupabaseClient, input: unknown) {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { error } = await supabase.rpc("open_claim", {
    p_order: parsed.data.orderId,
    p_reason: parsed.data.reason,
    p_description: parsed.data.description,
    p_photos: parsed.data.photos,
  });
  if (error) return failure(error);
  return success();
}
