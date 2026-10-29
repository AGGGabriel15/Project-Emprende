"use server";

import { revalidatePath } from "next/cache";
import { failure, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import {
  cancelOrderWith,
  completeWithPinWith,
  markOrderReadyWith,
  openClaimWith,
  rateDeliveryWith,
  submitReviewWith,
} from "./mutations";
import { processPendingRefunds } from "./server";

/** Envoltorios del web sobre ./mutations (compartido con la app móvil). */

export async function submitReview(input: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure({ message: "Inicia sesión." });
  const result = await submitReviewWith(supabase, user.id, input);
  if (result.ok) revalidatePath(`/pedidos/${(input as { orderId: string }).orderId}`);
  return result;
}

/** Calificación del repartidor (independiente de la reseña del negocio). */
export async function rateDelivery(input: unknown) {
  const result = await rateDeliveryWith(await createClient(), input);
  if (result.ok) revalidatePath(`/pedidos/${(input as { orderId: string }).orderId}`);
  return result;
}

/** El negocio marca "listo" con la foto del pedido empacado (evidencia para la recolección). */
export async function markOrderReady(orderId: string, photoPath: string) {
  const result = await markOrderReadyWith(await createClient(), orderId, photoPath);
  if (result.ok) revalidatePath("/vendedor/pedidos");
  return result;
}

/** Retiro en el negocio: se entrega solo con el PIN del cliente. */
export async function completeWithPin(orderId: string, pin: string) {
  const result = await completeWithPinWith(await createClient(), orderId, pin);
  if (result.ok) revalidatePath("/vendedor/pedidos");
  return result;
}

/**
 * Cancela con motivo (repone stock y deja el reembolso total en cola).
 * Si cancela el negocio, la base registra una falta.
 */
export async function cancelOrder(input: unknown) {
  const result = await cancelOrderWith(await createClient(), input);
  if (!result.ok) return result;
  if (result.data.queued) {
    const refunds = await processPendingRefunds(result.data.orderId);
    if (refunds.failed) {
      return failure({ message: "El pedido se canceló, pero el reembolso quedó pendiente. La administración lo revisará." });
    }
  }
  revalidatePath("/vendedor/pedidos");
  revalidatePath("/admin/pedidos");
  return success();
}

/** El cliente reporta un problema dentro de las 48 h siguientes a la entrega. */
export async function openClaim(input: unknown) {
  const result = await openClaimWith(await createClient(), input);
  if (result.ok) revalidatePath(`/pedidos/${(input as { orderId: string }).orderId}`);
  return result;
}
