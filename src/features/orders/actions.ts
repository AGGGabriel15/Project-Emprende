"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, invalid, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { refundOrder } from "./server";

const reviewSchema = z.object({
  orderId: z.string().uuid(),
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function submitReview(input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure({ message: "Inicia sesión." });
  const { data: order } = await supabase
    .from("orders")
    .select("business_id")
    .eq("id", parsed.data.orderId)
    .single();
  const { error } = await supabase.from("reviews").insert({
    order_id: parsed.data.orderId,
    business_id: order?.business_id,
    customer_id: user.id,
    rating: parsed.data.rating,
    comment: parsed.data.comment || null,
  });
  if (error) {
    return failure(error.code === "23505" ? { message: "Ya calificaste este pedido." } : error);
  }
  revalidatePath(`/pedidos/${parsed.data.orderId}`);
  return success();
}

const transitionSchema = z.object({
  orderId: z.string().uuid(),
  to: z.enum(["ready_for_pickup", "on_the_way", "completed"]),
  note: z.string().trim().max(300).optional(),
});

/** Negocio o admin avanzan el pedido; transition_order() valida la máquina de estados. */
export async function transitionOrder(input: unknown) {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_order", {
    p_order: parsed.data.orderId,
    p_to: parsed.data.to,
    p_note: parsed.data.note ?? null,
  });
  if (error) return failure(error);
  revalidatePath("/vendedor/pedidos");
  return success();
}

const cancelSchema = z.object({
  orderId: z.string().uuid(),
  reason: z.string().trim().min(5, "Explica el motivo (mínimo 5 caracteres).").max(300),
});

/** Cancela con motivo (repone stock) y, si estaba pagado, reembolsa. */
export async function cancelOrder(input: unknown) {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: needsRefund, error } = await supabase.rpc("cancel_order", {
    p_order: parsed.data.orderId,
    p_reason: parsed.data.reason,
  });
  if (error) return failure(error);
  if (needsRefund) {
    try {
      await refundOrder(parsed.data.orderId, parsed.data.reason, user?.id ?? null);
    } catch (err) {
      console.error("[cancel-refund]", err);
      return failure({ message: "El pedido se canceló, pero el reembolso falló. Revísalo en administración." });
    }
  }
  revalidatePath("/vendedor/pedidos");
  revalidatePath("/admin/pedidos");
  return success();
}
