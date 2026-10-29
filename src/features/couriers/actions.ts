"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { failure, success } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

/**
 * Acciones del repartidor. Cada función SQL valida que el envío sea suyo y el
 * paso en que va; aquí solo se suben las fotos (a su carpeta) y se llama la RPC.
 */

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PIN_MESSAGES: Record<string, string> = {
  wrong_pin: "PIN incorrecto. Pídele al cliente el código de 4 dígitos que ve en su pedido.",
  locked: "Demasiados intentos con PIN incorrecto. Llama a Catarina Market.",
  invalid: "El pedido no tiene PIN.",
};

const id = z.string().uuid();
const coord = z.coerce.number().min(-180).max(180).nullable().optional();

function coords(form: FormData) {
  const lat = coord.safeParse(form.get("lat") || null);
  const lng = coord.safeParse(form.get("lng") || null);
  return { p_lat: lat.success ? (lat.data ?? null) : null, p_lng: lng.success ? (lng.data ?? null) : null };
}

function refresh(shipment?: string) {
  revalidatePath("/repartidor");
  if (shipment) revalidatePath(`/repartidor/entrega/${shipment}`);
}

export async function setOnline(online: boolean, lat?: number | null, lng?: number | null) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_courier_online", { p_online: online, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return failure(error);
  refresh();
  return success();
}

export async function acceptShipment(shipment: string) {
  if (!id.safeParse(shipment).success) return failure({ message: "Envío no válido." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_shipment", { p_shipment: shipment });
  if (error) return failure(error);
  refresh(shipment);
  return success();
}

export async function releaseShipment(shipment: string, reason: string) {
  if (!id.safeParse(shipment).success) return failure({ message: "Envío no válido." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("courier_release", { p_shipment: shipment, p_reason: reason });
  if (error) return failure(error);
  refresh(shipment);
  return success();
}

export async function arrive(shipment: string, stage: "pickup" | "dropoff", lat?: number | null, lng?: number | null) {
  if (!id.safeParse(shipment).success) return failure({ message: "Envío no válido." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("courier_arrive", { p_shipment: shipment, p_stage: stage, p_lat: lat ?? null, p_lng: lng ?? null });
  if (error) return failure(error);
  refresh(shipment);
  return success();
}

async function uploadPhoto(userId: string, shipment: string, file: FormDataEntryValue | null) {
  if (!(file instanceof File) || !file.size) throw new Error("Toma la foto.");
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Formato de foto no permitido.");
  if (file.size > 3 * 1024 * 1024) throw new Error("La foto es muy pesada.");
  const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
  const path = `${userId}/courier/${shipment}/${crypto.randomUUID()}.${ext}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("delivery-evidence").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}

/** Recoger, rechazar, entregar con PIN o registrar un intento fallido. */
export async function courierStep(shipment: string, kind: "pickup" | "reject" | "deliver" | "fail", form: FormData) {
  if (!id.safeParse(shipment).success) return failure({ message: "Envío no válido." });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure({ message: "Inicia sesión de nuevo." });
  const notes = String(form.get("notes") ?? "");
  let refundsFor: string | null = null;
  try {
    if (kind === "fail") {
      const { data, error } = await supabase.rpc("courier_fail", { p_shipment: shipment, p_notes: notes });
      if (error) return failure(error);
      if (data === "returned") refundsFor = shipment;
    } else {
      const photo = await uploadPhoto(user.id, shipment, form.get("photo"));
      if (kind === "pickup") {
        const { error } = await supabase.rpc("courier_pickup", { p_shipment: shipment, p_photo_path: photo, p_notes: notes, ...coords(form) });
        if (error) return failure(error);
      } else if (kind === "reject") {
        const { error } = await supabase.rpc("courier_reject", { p_shipment: shipment, p_reason: notes, p_photo_path: photo });
        if (error) return failure(error);
        refundsFor = shipment;
      } else {
        const { data, error } = await supabase.rpc("courier_deliver", {
          p_shipment: shipment,
          p_pin: String(form.get("pin") ?? "").trim(),
          p_photo_path: photo,
          ...coords(form),
        });
        if (error) return failure(error);
        if (data !== "ok") return failure({ message: PIN_MESSAGES[data as string] ?? "No se pudo confirmar la entrega." });
      }
    }
  } catch (error) {
    return failure(error, "No pudimos registrar el paso.");
  }
  if (refundsFor) {
    // El reembolso queda en cola en la base; se procesa con la pasarela desde el servidor.
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { processPendingRefunds } = await import("@/features/orders/server");
    const { data } = await createAdminClient().from("shipments").select("order_id").eq("id", refundsFor).single();
    if (data) await processPendingRefunds(data.order_id);
  }
  refresh(shipment);
  revalidatePath("/admin/envios");
  return success();
}
