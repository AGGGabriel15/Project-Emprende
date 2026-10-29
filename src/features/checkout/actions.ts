"use server";

import { confirmPayment } from "@/features/orders/server";
import { getPaymentProvider } from "@/features/payments/provider";
import { failure, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";
import { placeOrderWith, quoteWith, resumePaymentWith } from "./server";

export type { Quote, QuoteLine } from "./server";

/**
 * Vista previa del pedido con los datos actuales de la base (precio, stock,
 * horario, cobertura). Es lo mismo que validará create_order() al pagar.
 */
export async function quoteCheckout(input: unknown, clientPrices?: Record<string, number>) {
  return quoteWith(await createClient(), input, clientPrices);
}

/** Crea el pedido (create_order valida todo en una transacción) y abre el pago. */
export async function placeOrder(input: unknown) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return placeOrderWith(supabase, user, input);
}

/** Reabre el pago de un pedido pendiente (pestaña Pendientes). */
export async function resumePayment(orderId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return resumePaymentWith(supabase, user, orderId);
}

/** Pasarela simulada: hace el papel del webhook. Solo existe en modo mock. */
export async function completeMockPayment(orderId: string) {
  const provider = await getPaymentProvider();
  if (provider.name !== "mock") return failure({ message: "El pago simulado está desactivado." });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: order } = await supabase
    .from("orders")
    .select("id, customer_id, total_minor, status")
    .eq("id", orderId)
    .maybeSingle();
  if (!user || !order || order.customer_id !== user.id) return failure({ message: "Pedido no encontrado." });
  try {
    const outcome = await confirmPayment(orderId, "mock", `mock_pi_${crypto.randomUUID().slice(0, 12)}`, order.total_minor);
    return success({ outcome });
  } catch (err) {
    return failure(err, "No pudimos confirmar el pago.");
  }
}
