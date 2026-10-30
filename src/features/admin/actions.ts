"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { failure, invalid, success } from "@/lib/actions";
import { processPendingRefunds } from "@/features/orders/server";
import { button, escape, sendEmail } from "@/lib/email";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import { passwordSchema } from "@/lib/validations/auth";
import { phoneSchema } from "@/lib/validations/common";

// Límites por nivel de vendedor (platform_settings); los montos van en centavos.
const LIMIT_KEYS = [
  "first_products_review",
  "informal_max_active_orders",
  "informal_monthly_cap_minor",
  "informal_trusted_after_orders",
  "informal_trusted_max_active_orders",
  "informal_trusted_monthly_cap_minor",
  "formal_max_active_orders",
] as const;

async function ownerEmail(businessId: string) {
  const { data } = await createAdminClient()
    .from("businesses")
    .select("trade_name, owner:profiles!businesses_owner_id_fkey(email, full_name)")
    .eq("id", businessId)
    .single();
  return data as unknown as { trade_name: string; owner: { email: string | null; full_name: string } | null } | null;
}

const reviewSchema = z.object({
  businessId: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  reason: z.string().trim().max(500).optional(),
});

export async function reviewApplication(input: unknown) {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { businessId, decision, reason } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_business_application", {
    p_business: businessId,
    p_decision: decision,
    p_reason: reason ?? null,
  });
  if (error) return failure(error);

  const info = await ownerEmail(businessId);
  if (info?.owner?.email) {
    await sendEmail(
      info.owner.email,
      decision === "approved" ? `¡${info.trade_name} fue aprobado!` : "Tu solicitud necesita cambios",
      decision === "approved"
        ? `<p>Hola ${escape(info.owner.full_name)}, tu negocio ya está publicado en Catarina Market. Configura tus horarios, zonas de delivery y productos.</p>${button("/vendedor/panel", "Ir a mi panel")}`
        : `<p>Hola ${escape(info.owner.full_name)}, revisamos tu solicitud y necesitamos que corrijas lo siguiente:</p><p style="background:#fbeee9;padding:12px;border-radius:8px">${escape(reason ?? "")}</p>${button("/vendedor/solicitud", "Corregir y reenviar")}`,
    );
  }
  revalidatePath("/admin", "layout");
  return success();
}

export async function setBusinessSuspended(businessId: string, suspended: boolean, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_business_suspended", {
    p_business: businessId,
    p_suspended: suspended,
    p_reason: reason ?? null,
  });
  if (error) return failure(error);
  revalidatePath("/admin/negocios");
  return success();
}

/** URL firmada (10 min) para ver un documento privado. */
export async function documentUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("business-documents").createSignedUrl(path, 600);
  if (error || !data) return failure(error, "No pudimos abrir el documento.");
  return success(data.signedUrl);
}

const userSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["customer", "vendor", "admin"]),
  active: z.boolean(),
});

export async function updateUser(input: unknown) {
  const parsed = userSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_user", {
    p_user: parsed.data.userId,
    p_role: parsed.data.role,
    p_active: parsed.data.active,
  });
  if (error) return failure(error);
  revalidatePath("/admin/usuarios");
  return success();
}

const createAdminSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(2),
  password: z.string().min(8),
});

/** Los admins solo los crea otro admin (nunca auto-registro). */
export async function createAdminUser(input: unknown) {
  const parsed = createAdminSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return failure({ message: "Solo administradores." });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName },
  });
  if (error) return failure(error);
  await admin.from("profiles").update({ role: "admin" }).eq("id", data.user.id);
  await supabase.rpc("admin_log", {
    p_action: "user.create_admin",
    p_entity: "profile",
    p_entity_id: data.user.id,
    p_details: { email: parsed.data.email },
  });
  revalidatePath("/admin/usuarios");
  return success();
}

const passwordResetSchema = z.object({
  userId: z.string().uuid(),
  password: passwordSchema,
});

/**
 * El admin fija una contraseña nueva a un cliente, vendedor o repartidor
 * (nunca a otro administrador). Queda en la auditoría (sin la contraseña) y se
 * avisa al usuario por correo.
 */
export async function setUserPassword(input: unknown) {
  const parsed = passwordResetSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return failure({ message: "Solo administradores." });
  const admin = createAdminClient();
  const { data: target } = await admin.from("profiles").select("role, email, full_name").eq("id", parsed.data.userId).maybeSingle();
  if (!target) return failure({ message: "Usuario no encontrado." });
  if (target.role === "admin") return failure({ message: "No puedes cambiar la contraseña de un administrador." });
  const { error } = await admin.auth.admin.updateUserById(parsed.data.userId, { password: parsed.data.password });
  if (error) return failure({ message: "No pudimos cambiar la contraseña." });
  await supabase.rpc("admin_log", {
    p_action: "user.password_reset",
    p_entity: "profile",
    p_entity_id: parsed.data.userId,
    p_details: { email: target.email, role: target.role },
  });
  await sendEmail(
    target.email,
    "Tu contraseña de Catarina Market cambió",
    `<p>Hola ${escape(target.full_name ?? "")}, la administración de Catarina Market te asignó una contraseña nueva.</p><p>Si no lo pediste, escríbenos de inmediato.</p>${button("/login", "Entrar")}`,
  );
  revalidatePath("/admin/auditoria");
  return success();
}

/** Visita de verificación al local (obligatoria para emprendedores informales). */
export async function recordVerificationVisit(businessId: string, notes: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_verification_visit", { p_business: businessId, p_notes: notes });
  if (error) return failure(error);
  revalidatePath(`/admin/solicitudes/${businessId}`);
  return success();
}

/** Aprueba o rechaza el paso de emprendedor informal a Negocio formal. */
export async function reviewFormalUpgrade(businessId: string, approve: boolean, reason?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_formal_upgrade", {
    p_business: businessId,
    p_approve: approve,
    p_reason: reason ?? null,
  });
  if (error) return failure(error);
  revalidatePath("/admin/solicitudes", "layout");
  return success();
}

/** Moderación de los primeros productos de cada negocio. */
export async function reviewProduct(productId: string, approve: boolean, note?: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_product", {
    p_product: productId,
    p_approve: approve,
    p_note: note ?? null,
  });
  if (error) return failure(error);
  revalidatePath("/admin/moderacion");
  return success();
}

export async function setSetting(key: string, value: unknown) {
  const allowed = ["commission_rate", "pending_payment_minutes", "support_email", "support_whatsapp", ...LIMIT_KEYS];
  if (!allowed.includes(key)) return failure({ message: "Parámetro desconocido." });
  if (key === "commission_rate" && !(typeof value === "number" && value >= 0 && value < 0.5)) {
    return failure({ message: "La comisión debe estar entre 0 % y 50 %." });
  }
  if (key === "pending_payment_minutes" && !(typeof value === "number" && value >= 30 && value <= 1440)) {
    return failure({ message: "Entre 30 y 1440 minutos (Stripe exige al menos 30)." });
  }
  if ((LIMIT_KEYS as readonly string[]).includes(key) && !(typeof value === "number" && Number.isInteger(value) && value >= 0)) {
    return failure({ message: "Los límites deben ser números enteros positivos." });
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_setting", { p_key: key, p_value: value });
  if (error) return failure(error);
  revalidatePath("/admin", "layout");
  return success();
}

const ruleSchema = z
  .object({
    businessId: z.string().uuid().optional().or(z.literal("")),
    categoryId: z.coerce.number().int().optional(),
    ratePercent: z.coerce.number().min(0).max(50),
    validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    validTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
    note: z.string().trim().max(200).optional(),
  })
  .refine((d) => Boolean(d.businessId) !== Boolean(d.categoryId), { message: "Elige un negocio o una categoría." });

export async function saveCommissionRule(input: unknown) {
  const parsed = ruleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const d = parsed.data;
  const { data, error } = await supabase
    .from("commission_rules")
    .insert({
      business_id: d.businessId || null,
      category_id: d.businessId ? null : d.categoryId,
      rate: d.ratePercent / 100,
      valid_from: d.validFrom,
      valid_to: d.validTo || null,
      note: d.note || null,
    })
    .select("id")
    .single();
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "commission.rule_create", p_entity: "commission_rule", p_entity_id: data.id, p_details: d });
  revalidatePath("/admin/comisiones");
  return success();
}

export async function deleteCommissionRule(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("commission_rules").delete().eq("id", id);
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "commission.rule_delete", p_entity: "commission_rule", p_entity_id: id, p_details: {} });
  revalidatePath("/admin/comisiones");
  return success();
}

export async function generatePayouts(start: string, end: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_payouts", { p_start: start, p_end: end });
  if (error) return failure(error);
  revalidatePath("/admin/pagos-negocios");
  return success(data as number);
}

export async function markPayoutPaid(id: string, reference: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_payout_paid", { p_payout: id, p_reference: reference });
  if (error) return failure(error);
  revalidatePath("/admin/pagos-negocios");
  return success();
}

const categorySchema = z.object({
  name: z.string().trim().min(2).max(60),
  icon: z.string().trim().min(2).max(30),
  isActive: z.boolean(),
});

export async function savePlatformCategory(input: unknown, id?: number) {
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const row = { name: parsed.data.name, icon: parsed.data.icon, is_active: parsed.data.isActive };
  const { error } = id
    ? await supabase.from("platform_categories").update(row).eq("id", id)
    : await supabase.from("platform_categories").insert({ ...row, slug: slugify(parsed.data.name), sort_order: 99 });
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: id ? "category.update" : "category.create", p_entity: "platform_category", p_entity_id: id ? String(id) : null, p_details: row });
  revalidatePath("/admin/categorias");
  return success();
}

const zoneSchema = z.object({
  departmentId: z.coerce.number().int().min(1, "Elige un departamento."),
  municipalityId: z.coerce.number().int().min(0).optional(),
  fee: z.coerce.number().min(0, "Tarifa inválida.").max(5000),
  courierCost: z.coerce.number().min(0, "Costo inválido.").max(5000),
  estimatedDays: z.coerce.number().int().min(0).max(15),
});

/** Tarifa de envío de la plataforma (cliente) y costo del repartidor por zona. */
export async function savePlatformZone(input: unknown) {
  const parsed = zoneSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const row = {
    department_id: parsed.data.departmentId,
    municipality_id: parsed.data.municipalityId || null,
    fee_minor: Math.round(parsed.data.fee * 100),
    courier_cost_minor: Math.round(parsed.data.courierCost * 100),
    estimated_days: parsed.data.estimatedDays,
    is_active: true,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("platform_delivery_zones")
    .upsert(row, { onConflict: "department_id,municipality_id" });
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "zone.save", p_entity: "platform_zone", p_entity_id: null, p_details: row });
  revalidateTag("platform-zones", { expire: 0 });
  revalidatePath("/admin/zonas");
  return success();
}

export async function deleteZoneAsAdmin(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("platform_delivery_zones").delete().eq("id", id);
  if (error) return failure(error);
  await supabase.rpc("admin_log", { p_action: "zone.delete", p_entity: "platform_zone", p_entity_id: id, p_details: {} });
  revalidateTag("platform-zones", { expire: 0 });
  revalidatePath("/admin/zonas");
  return success();
}

// Logística, reclamos, faltas y reembolsos -------------------------------------

const shipmentSchema = z.object({
  orderId: z.string().uuid(),
  courierId: z.string().uuid("Elige un repartidor."),
  cost: z.coerce.number().min(0).max(5000).optional(),
});

/** Asigna o reasigna el envío a un repartidor (solo antes de la recolección). */
export async function assignShipment(input: unknown) {
  const parsed = shipmentSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_shipment", {
    p_order: parsed.data.orderId,
    p_courier: parsed.data.courierId,
    p_cost: parsed.data.cost === undefined ? null : Math.round(parsed.data.cost * 100),
  });
  if (error) return failure(error);
  revalidatePath("/admin/envios");
  return success();
}

/** Entrega sin PIN (cliente sin teléfono, etc.): queda auditada con el motivo. */
export async function confirmDeliveryWithoutPin(orderId: string, reason: string) {
  if (!z.string().uuid().safeParse(orderId).success) return failure({ message: "Pedido no válido." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_confirm_delivery", { p_order: orderId, p_reason: reason });
  if (error) return failure(error);
  revalidatePath("/admin/envios");
  return success();
}

const courierSchema = z.object({
  fullName: z.string().trim().min(3, "Escribe el nombre completo.").max(120),
  email: z.string().trim().toLowerCase().email("Correo no válido."),
  phone: phoneSchema,
  vehicle: z.enum(["moto", "bici", "carro"]),
  plate: z.string().trim().max(20).optional(),
  password: z.string().min(8, "La contraseña temporal debe tener al menos 8 caracteres."),
});

/** Los repartidores son empleados: el admin crea su cuenta (no hay registro público). */
export async function createCourier(input: unknown) {
  const parsed = courierSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return failure({ message: "Solo administradores." });
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: { full_name: parsed.data.fullName, accepted_terms: true },
  });
  if (error) {
    return failure(/already|registered|exists/i.test(error.message) ? { message: "Ya existe una cuenta con ese correo." } : error);
  }
  const { error: makeError } = await supabase.rpc("admin_make_courier", {
    p_user: data.user.id,
    p_full_name: parsed.data.fullName,
    p_phone: parsed.data.phone,
    p_vehicle: parsed.data.vehicle,
    p_plate: parsed.data.plate ?? "",
  });
  if (makeError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return failure(makeError);
  }
  revalidatePath("/admin/repartidores");
  return success();
}

export async function setCourierActive(userId: string, active: boolean) {
  if (!z.string().uuid().safeParse(userId).success) return failure({ message: "Repartidor no válido." });
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_courier_active", { p_user: userId, p_active: active });
  if (error) return failure(error);
  revalidatePath("/admin/repartidores");
  return success();
}

const resolveSchema = z.object({
  claimId: z.string().uuid(),
  approve: z.boolean(),
  refund: z.coerce.number().min(0).optional(),
  responsible: z.enum(["business", "platform", "courier"]).optional(),
  note: z.string().trim().min(5, "Explica la decisión.").max(600),
});

export async function resolveClaim(input: unknown) {
  const parsed = resolveSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { data: queued, error } = await supabase.rpc("resolve_claim", {
    p_claim: parsed.data.claimId,
    p_approve: parsed.data.approve,
    p_refund_minor: parsed.data.approve ? Math.round((parsed.data.refund ?? 0) * 100) : null,
    p_responsible: parsed.data.approve ? parsed.data.responsible ?? null : null,
    p_note: parsed.data.note,
  });
  if (error) return failure(error);
  if (queued) {
    const { data: claim } = await supabase.from("claims").select("order_id").eq("id", parsed.data.claimId).single();
    if (claim) await processPendingRefunds(claim.order_id);
  }
  revalidatePath("/admin/reclamos");
  return success();
}

export async function voidStrike(strikeId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_strike", { p_strike: strikeId, p_reason: reason });
  if (error) return failure(error);
  revalidatePath("/admin/reclamos");
  return success();
}

/** Reintenta los reembolsos en cola (los fallidos quedan con su error a la vista). */
export async function processRefundsNow() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) return failure({ message: "Solo administradores." });
  const result = await processPendingRefunds();
  revalidatePath("/admin/reclamos");
  return result.failed
    ? failure({ message: `${result.processed} procesados, ${result.failed} con error (revisa el detalle).` })
    : success(result);
}
